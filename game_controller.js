// 2048 Game Environment Controller
const canvas = document.getElementById('environment-canvas');
const ctx = canvas.getContext('2d');

// Configuration
const GRID_SIZE = 4;
const CELL_SIZE = 140;
const CELL_MARGIN = 10;
const BOARD_SIZE = GRID_SIZE * CELL_SIZE + (GRID_SIZE + 1) * CELL_MARGIN;
const OFFSET_X = (canvas.width - BOARD_SIZE) / 2;
const OFFSET_Y = (canvas.height - BOARD_SIZE) / 2;

// Environment state
let currentAlgorithm = 'qlearning';
let isTraining = false;
let animationSpeed = 100;
let agents = {};
let agent = null;
let environment = null;

// Statistics
let episodeCount = 0;
let scoreHistory = [];
let maxTileHistory = [];

// Charts
let scoreChart = null;
let tileChart = null;

// Color scheme for tiles
const TILE_COLORS = {
    0: '#cdc1b4',
    2: '#eee4da',
    4: '#ede0c8',
    8: '#f2b179',
    16: '#f59563',
    32: '#f67c5f',
    64: '#f65e3b',
    128: '#edcf72',
    256: '#edcc61',
    512: '#edc850',
    1024: '#edc53f',
    2048: '#edc22e',
    4096: '#3c3a32'
};

// 2048 Game Environment
class Game2048 {
    constructor() {
        this.grid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));
        this.score = 0;
        this.moves = 0;
        this.reset();
    }

    reset() {
        this.grid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));
        this.score = 0;
        this.moves = 0;
        this.addRandomTile();
        this.addRandomTile();
        return this.getState();
    }

    addRandomTile() {
        const emptyCells = [];
        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                if (this.grid[i][j] === 0) {
                    emptyCells.push({ i, j });
                }
            }
        }
        
        if (emptyCells.length > 0) {
            const { i, j } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            this.grid[i][j] = Math.random() < 0.9 ? 2 : 4;
        }
    }

    getState() {
        // Simplified state representation (hash of grid)
        let state = 0;
        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                const value = this.grid[i][j];
                const tileValue = value > 0 ? Math.log2(value) : 0;
                state = state * 16 + tileValue;
            }
        }
        return Math.abs(state) % 1000000; // Reduce state space
    }

    step(action) {
        // Actions: 0=up, 1=right, 2=down, 3=left
        const oldGrid = JSON.parse(JSON.stringify(this.grid));
        const oldScore = this.score;
        let moved = false;

        switch (action) {
            case 0: moved = this.moveUp(); break;
            case 1: moved = this.moveRight(); break;
            case 2: moved = this.moveDown(); break;
            case 3: moved = this.moveLeft(); break;
        }

        let reward = 0;
        
        if (!moved) {
            reward = -5; // Penalty for invalid move
        } else {
            this.moves++;
            const scoreDelta = this.score - oldScore;
            
            if (scoreDelta > 0) {
                reward = Math.log2(scoreDelta + 1) * 10; // Increased reward for merges (was 3)
            } else {
                reward = 0.2; // Small reward for valid move
            }
            
            // Bonus for creating high-value tiles
            const maxTile = this.getMaxTile();
            reward += Math.log2(maxTile + 1) * 2; // Increased tile bonus (was 0.2)
            
            this.addRandomTile();
        }

        const done = !this.canMove();
        
        if (done) {
            // Penalty scaled by final score (higher score = less penalty)
            const finalScore = this.score;
            reward -= Math.max(0, 100 - Math.log2(finalScore + 1) * 10);
        }

        return {
            state: this.getState(),
            reward: reward,
            done: done
        };
    }

    moveLeft() {
        let moved = false;
        for (let i = 0; i < GRID_SIZE; i++) {
            const row = this.grid[i].filter(val => val !== 0);
            const newRow = [];
            
            for (let j = 0; j < row.length; j++) {
                if (j < row.length - 1 && row[j] === row[j + 1]) {
                    newRow.push(row[j] * 2);
                    this.score += row[j] * 2;
                    j++;
                    moved = true;
                } else {
                    newRow.push(row[j]);
                }
            }
            
            while (newRow.length < GRID_SIZE) {
                newRow.push(0);
            }
            
            if (JSON.stringify(newRow) !== JSON.stringify(this.grid[i])) {
                moved = true;
            }
            this.grid[i] = newRow;
        }
        return moved;
    }

    moveRight() {
        this.reverseRows();
        const moved = this.moveLeft();
        this.reverseRows();
        return moved;
    }

    moveUp() {
        this.transpose();
        const moved = this.moveLeft();
        this.transpose();
        return moved;
    }

    moveDown() {
        this.transpose();
        this.reverseRows();
        const moved = this.moveLeft();
        this.reverseRows();
        this.transpose();
        return moved;
    }

    transpose() {
        const newGrid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));
        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                newGrid[j][i] = this.grid[i][j];
            }
        }
        this.grid = newGrid;
    }

    reverseRows() {
        this.grid = this.grid.map(row => row.reverse());
    }

    canMove() {
        // Check for empty cells
        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                if (this.grid[i][j] === 0) return true;
            }
        }
        
        // Check for possible merges
        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                const current = this.grid[i][j];
                if (j < GRID_SIZE - 1 && current === this.grid[i][j + 1]) return true;
                if (i < GRID_SIZE - 1 && current === this.grid[i + 1][j]) return true;
            }
        }
        
        return false;
    }

    getMaxTile() {
        let max = 0;
        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                max = Math.max(max, this.grid[i][j]);
            }
        }
        return max;
    }

    render() {
        // Clear canvas
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw board background
        ctx.fillStyle = '#bbada0';
        ctx.fillRect(OFFSET_X, OFFSET_Y, BOARD_SIZE, BOARD_SIZE);

        // Draw tiles
        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                this.drawTile(i, j, this.grid[i][j]);
            }
        }

        // Draw score
        ctx.fillStyle = 'rgba(26, 26, 46, 0.8)';
        ctx.fillRect(OFFSET_X, OFFSET_Y - 60, BOARD_SIZE, 50);
        
        ctx.fillStyle = '#e0e0e0';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Score: ${this.score}`, OFFSET_X + 10, OFFSET_Y - 30);
        
        ctx.textAlign = 'right';
        ctx.fillText(`Moves: ${this.moves}`, OFFSET_X + BOARD_SIZE - 10, OFFSET_Y - 30);
    }

    drawTile(row, col, value) {
        const x = OFFSET_X + col * (CELL_SIZE + CELL_MARGIN) + CELL_MARGIN;
        const y = OFFSET_Y + row * (CELL_SIZE + CELL_MARGIN) + CELL_MARGIN;

        // Tile background
        ctx.fillStyle = TILE_COLORS[value] || TILE_COLORS[4096];
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

        // Tile value
        if (value > 0) {
            ctx.fillStyle = value <= 4 ? '#776e65' : '#f9f6f2';
            ctx.font = value < 100 ? 'bold 60px Arial' : 
                      value < 1000 ? 'bold 50px Arial' : 'bold 40px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(value.toString(), x + CELL_SIZE / 2, y + CELL_SIZE / 2);
        }
    }
}

// Initialize
function init() {
    environment = new Game2048();
    
    const stateSpace = 1000000; // Large state space
    const actionSpace = 4; // up, right, down, left
    
    agents = {
        qlearning: new QLearningAgent(stateSpace, actionSpace, { 
            alpha: 0.15, 
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.999,
            epsilonMin: 0.1
        }),
        sarsa: new SARSAAgent(stateSpace, actionSpace, { 
            alpha: 0.15, 
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.999,
            epsilonMin: 0.1
        }),
        montecarlo: new MonteCarloAgent(stateSpace, actionSpace, {
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.999,
            epsilonMin: 0.1
        }),
        dqn: new DQNAgent(stateSpace, actionSpace, { 
            alpha: 0.001,
            memorySize: 5000,
            batchSize: 64
        })
    };

    agent = agents[currentAlgorithm];
    initCharts();
    environment.render();
}

function initCharts() {
    const chartConfig = {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { color: '#a0a0b0' },
                    grid: { color: '#2a2a3e' }
                },
                x: { 
                    ticks: { color: '#a0a0b0' },
                    grid: { color: '#2a2a3e' }
                }
            },
            plugins: { legend: { display: false } }
        }
    };

    scoreChart = new Chart(document.getElementById('scoreChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                label: 'Score',
                data: [],
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4
            }]
        }
    });

    tileChart = new Chart(document.getElementById('tileChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                label: 'Max Tile',
                data: [],
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                tension: 0.4
            }]
        }
    });
}

function switchAlgorithm(algo) {
    currentAlgorithm = algo;
    agent = agents[algo];
    
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`${algo}-content`).classList.add('active');
}

function updateSpeed(value) {
    animationSpeed = value;
    document.getElementById('speedValue').textContent = value;
}

async function startTraining() {
    isTraining = true;
    document.getElementById('trainBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;

    while (isTraining && episodeCount < 300) {
        await runEpisode();
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    document.getElementById('trainBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
}

function stopTraining() {
    isTraining = false;
}

async function runEpisode() {
    let state = environment.reset();
    let done = false;

    while (!done) {
        const action = agent.selectAction(state);
        const result = environment.step(action);
        
        agent.update(state, action, result.reward, result.state, result.done);
        
        state = result.state;
        done = result.done;
        
        environment.render();
        await new Promise(resolve => setTimeout(resolve, animationSpeed));
    }

    episodeCount++;
    scoreHistory.push(environment.score);
    maxTileHistory.push(environment.getMaxTile());
    
    // Decay epsilon after episode for Q-Learning and SARSA
    if (agent.decayEpsilon) {
        agent.decayEpsilon();
    }

    updateStats();
    updateCharts();
}

function updateStats() {
    document.getElementById('episode').textContent = episodeCount;
    document.getElementById('score').textContent = environment.score;
    document.getElementById('maxTile').textContent = environment.getMaxTile();
    document.getElementById('moves').textContent = environment.moves;
}

function updateCharts() {
    const maxPoints = 50;
    const start = Math.max(0, scoreHistory.length - maxPoints);
    
    scoreChart.data.labels = Array.from({ length: scoreHistory.length - start }, (_, i) => start + i + 1);
    scoreChart.data.datasets[0].data = scoreHistory.slice(start);
    scoreChart.update('none');

    tileChart.data.labels = Array.from({ length: maxTileHistory.length - start }, (_, i) => start + i + 1);
    tileChart.data.datasets[0].data = maxTileHistory.slice(start);
    tileChart.update('none');
}

function resetEnvironment() {
    episodeCount = 0;
    scoreHistory = [];
    maxTileHistory = [];
    
    environment = new Game2048();
    agents = {
        qlearning: new QLearningAgent(1000000, 4, { 
            alpha: 0.15, 
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.999,
            epsilonMin: 0.1
        }),
        sarsa: new SARSAAgent(1000000, 4, { 
            alpha: 0.15, 
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.999,
            epsilonMin: 0.1
        }),
        montecarlo: new MonteCarloAgent(1000000, 4, {
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.999,
            epsilonMin: 0.1
        }),
        dqn: new DQNAgent(1000000, 4, { 
            alpha: 0.001,
            memorySize: 5000,
            batchSize: 64
        })
    };
    agent = agents[currentAlgorithm];
    
    updateStats();
    scoreChart.data.labels = [];
    scoreChart.data.datasets[0].data = [];
    scoreChart.update();
    tileChart.data.labels = [];
    tileChart.data.datasets[0].data = [];
    tileChart.update();
    
    environment.render();
}

window.addEventListener('load', init);

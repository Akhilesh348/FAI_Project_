// Maze Environment Controller
const canvas = document.getElementById('environment-canvas');
const ctx = canvas.getContext('2d');

// Configuration
const GRID_SIZE = 10;
const CELL_SIZE = canvas.width / GRID_SIZE;

// Environment state
let currentAlgorithm = 'qlearning';
let isTraining = false;
let animationSpeed = 50;
let agent = null;
let environment = null;
let learnedPath = []; // Store the learned optimal path

// Statistics
let episodeCount = 0;
let rewardHistory = [];
let stepsHistory = [];
let successCount = 0;

// Charts
let rewardChart = null;
let stepsChart = null;

// Maze Environment
class MazeEnvironment {
    constructor(size) {
        this.size = size;
        this.agentPos = { x: 0, y: 0 };
        this.goalPos = { x: size - 1, y: size - 1 };
        this.walls = this.generateMaze();
        this.reset();
    }

    generateMaze() {
        const walls = new Set();
        // Create random walls (about 12% of cells) - reduced for easier navigation
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                if (Math.random() < 0.12 && !(i === 0 && j === 0) && !(i === this.size - 1 && j === this.size - 1)) {
                    walls.add(`${i},${j}`);
                }
            }
        }
        return walls;
    }

    reset() {
        this.agentPos = { x: 0, y: 0 };
        return this.getState();
    }

    getState() {
        return this.agentPos.x * this.size + this.agentPos.y;
    }

    step(action) {
        // Actions: 0=up, 1=right, 2=down, 3=left
        const moves = [
            { x: -1, y: 0 },  // up
            { x: 0, y: 1 },   // right
            { x: 1, y: 0 },   // down
            { x: 0, y: -1 }   // left
        ];

        const move = moves[action];
        const newX = this.agentPos.x + move.x;
        const newY = this.agentPos.y + move.y;

        // Check boundaries and walls
        if (newX >= 0 && newX < this.size && newY >= 0 && newY < this.size) {
            if (!this.walls.has(`${newX},${newY}`)) {
                this.agentPos.x = newX;
                this.agentPos.y = newY;
            }
        }

        // Calculate reward with strong guidance
        let reward = -0.1; // Small step penalty
        let done = false;

        // Calculate distances
        const oldDist = Math.abs(this.agentPos.x - move.x - this.goalPos.x) + 
                       Math.abs(this.agentPos.y - move.y - this.goalPos.y);
        const newDist = Math.abs(this.agentPos.x - this.goalPos.x) + 
                       Math.abs(this.agentPos.y - this.goalPos.y);

        if (this.agentPos.x === this.goalPos.x && this.agentPos.y === this.goalPos.y) {
            reward = 10000; // Large goal reward
            done = true;
        } else {
            // Strong reward shaping for moving toward goal
            if (newDist < oldDist) {
                reward += 2; // Strong reward for getting closer
            } else if (newDist > oldDist) {
                reward -= 1; // Penalty for moving away
            }
            
            // Distance-based bonus
            const maxDist = this.size * 2;
            reward += (maxDist - newDist) * 0.3;
        }

        return {
            state: this.getState(),
            reward: reward,
            done: done
        };
    }

    render(showPath = false) {
        // Clear canvas
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        ctx.strokeStyle = '#2a2a3e';
        ctx.lineWidth = 1;
        for (let i = 0; i <= this.size; i++) {
            ctx.beginPath();
            ctx.moveTo(i * CELL_SIZE, 0);
            ctx.lineTo(i * CELL_SIZE, canvas.height);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, i * CELL_SIZE);
            ctx.lineTo(canvas.width, i * CELL_SIZE);
            ctx.stroke();
        }

        // Draw walls
        ctx.fillStyle = '#3a3a4e';
        this.walls.forEach(wall => {
            const [x, y] = wall.split(',').map(Number);
            ctx.fillRect(y * CELL_SIZE + 2, x * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
        });

        // Draw learned path if available
        if (showPath && learnedPath.length > 0) {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            for (let i = 0; i < learnedPath.length; i++) {
                const pos = learnedPath[i];
                const x = pos.y * CELL_SIZE + CELL_SIZE / 2;
                const y = pos.x * CELL_SIZE + CELL_SIZE / 2;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw goal
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(
            this.goalPos.y * CELL_SIZE + CELL_SIZE / 2,
            this.goalPos.x * CELL_SIZE + CELL_SIZE / 2,
            CELL_SIZE / 3,
            0,
            Math.PI * 2
        );
        ctx.fill();

        // Draw agent
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.arc(
            this.agentPos.y * CELL_SIZE + CELL_SIZE / 2,
            this.agentPos.x * CELL_SIZE + CELL_SIZE / 2,
            CELL_SIZE / 3,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }
}

// Initialize
function init() {
    environment = new MazeEnvironment(GRID_SIZE);
    
    // Initialize agents
    const stateSpace = GRID_SIZE * GRID_SIZE;
    const actionSpace = 4;
    
    agents = {
        qlearning: new QLearningAgent(stateSpace, actionSpace, { 
            alpha: 0.5, 
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.995,
            epsilonMin: 0.01
        }),
        sarsa: new SARSAAgent(stateSpace, actionSpace, { 
            alpha: 0.5, 
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.995,
            epsilonMin: 0.01
        }),
        montecarlo: new MonteCarloAgent(stateSpace, actionSpace, {
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.995,
            epsilonMin: 0.01
        }),
        dqn: new DQNAgent(stateSpace, actionSpace, { alpha: 0.01 })
    };

    agent = agents[currentAlgorithm];

    // Initialize charts
    initCharts();
    
    // Initial render
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
            plugins: {
                legend: { display: false }
            }
        }
    };

    rewardChart = new Chart(document.getElementById('rewardChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                label: 'Reward',
                data: [],
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4
            }]
        }
    });

    stepsChart = new Chart(document.getElementById('stepsChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                label: 'Steps',
                data: [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4
            }]
        }
    });
}

function switchAlgorithm(algo) {
    currentAlgorithm = algo;
    agent = agents[algo];
    
    // Update UI
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`${algo}-content`).classList.add('active');
}

function updateSpeed(value) {
    animationSpeed = value;
    document.getElementById('speedValue').value = value;
}

async function startTraining() {
    isTraining = true;
    document.getElementById('trainBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;
    document.getElementById('showPathBtn').disabled = true;

    while (isTraining && episodeCount < 1000) { // Increased from 500
        await runEpisode();
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    document.getElementById('trainBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('showPathBtn').disabled = false;
    
    // Extract learned policy after training
    extractLearnedPath();
}

function stopTraining() {
    isTraining = false;
    document.getElementById('showPathBtn').disabled = false;
}

async function runEpisode() {
    let state = environment.reset();
    let totalReward = 0;
    let steps = 0;
    const maxSteps = 300; // Increased from 200

    while (steps < maxSteps) {
        // Get action from agent
        const action = agent.selectAction(state);

        // Take step in environment
        const result = environment.step(action);
        
        // Update agent
        agent.update(state, action, result.reward, result.state, result.done);
        
        // Update state
        state = result.state;
        totalReward += result.reward;
        steps++;

        // Render
        environment.render();
        await new Promise(resolve => setTimeout(resolve, animationSpeed));

        if (result.done) {
            if (result.reward > 0) successCount++;
            break;
        }
    }

    // Update statistics
    episodeCount++;
    rewardHistory.push(totalReward);
    stepsHistory.push(steps);
    
    // Decay epsilon after episode for Q-Learning and SARSA
    if (agent.decayEpsilon) {
        agent.decayEpsilon();
    }

    updateStats();
    updateCharts();
}

function updateStats() {
    document.getElementById('episode').textContent = episodeCount;
    document.getElementById('reward').textContent = rewardHistory[rewardHistory.length - 1]?.toFixed(2) || 0;
    document.getElementById('steps').textContent = stepsHistory[stepsHistory.length - 1] || 0;
    document.getElementById('success').textContent = ((successCount / episodeCount) * 100).toFixed(1) + '%';
}

function updateCharts() {
    const maxPoints = 50;
    const start = Math.max(0, rewardHistory.length - maxPoints);
    
    rewardChart.data.labels = Array.from({ length: rewardHistory.length - start }, (_, i) => start + i + 1);
    rewardChart.data.datasets[0].data = rewardHistory.slice(start);
    rewardChart.update('none');

    stepsChart.data.labels = Array.from({ length: stepsHistory.length - start }, (_, i) => start + i + 1);
    stepsChart.data.datasets[0].data = stepsHistory.slice(start);
    stepsChart.update('none');
}

function resetEnvironment() {
    episodeCount = 0;
    rewardHistory = [];
    stepsHistory = [];
    successCount = 0;
    learnedPath = [];
    
    environment = new MazeEnvironment(GRID_SIZE);
    agents = {
        qlearning: new QLearningAgent(GRID_SIZE * GRID_SIZE, 4, { 
            alpha: 0.5, 
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.995,
            epsilonMin: 0.01
        }),
        sarsa: new SARSAAgent(GRID_SIZE * GRID_SIZE, 4, { 
            alpha: 0.5, 
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.995,
            epsilonMin: 0.01
        }),
        montecarlo: new MonteCarloAgent(GRID_SIZE * GRID_SIZE, 4, {
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.995,
            epsilonMin: 0.01
        }),
        dqn: new DQNAgent(GRID_SIZE * GRID_SIZE, 4, { alpha: 0.01 })
    };
    agent = agents[currentAlgorithm];
    
    updateStats();
    rewardChart.data.labels = [];
    rewardChart.data.datasets[0].data = [];
    rewardChart.update();
    stepsChart.data.labels = [];
    stepsChart.data.datasets[0].data = [];
    stepsChart.update();
    
    environment.render();
}

// Extract the learned optimal path using greedy policy
function extractLearnedPath() {
    learnedPath = [];
    let state = environment.reset();
    const visited = new Set();
    const maxSteps = GRID_SIZE * GRID_SIZE * 2;
    let steps = 0;
    
    learnedPath.push({ x: environment.agentPos.x, y: environment.agentPos.y });
    
    while (steps < maxSteps) {
        // Get best action (greedy, no exploration)
        const action = agent.getBestAction(state);
        
        // Take step
        const result = environment.step(action);
        
        // Add to path
        learnedPath.push({ x: environment.agentPos.x, y: environment.agentPos.y });
        
        // Check for loops
        const posKey = `${environment.agentPos.x},${environment.agentPos.y}`;
        if (visited.has(posKey) && steps > 5) {
            break; // Detected a loop, stop
        }
        visited.add(posKey);
        
        state = result.state;
        steps++;
        
        if (result.done) {
            break;
        }
    }
    
    console.log(`Learned path has ${learnedPath.length} steps`);
}

// Show the learned path
async function showLearnedPath() {
    if (learnedPath.length === 0) {
        extractLearnedPath();
    }
    
    // Reset environment to start
    environment.reset();
    
    // Animate through the learned path
    for (let i = 0; i < learnedPath.length; i++) {
        environment.agentPos = { ...learnedPath[i] };
        environment.render(true); // Show path
        await new Promise(resolve => setTimeout(resolve, 200));
    }
}

// Initialize on load
window.addEventListener('load', init);

// Delivery Drone Environment Controller
const canvas = document.getElementById('environment-canvas');
const ctx = canvas.getContext('2d');

// Configuration
const GRID_SIZE = 10;
const CELL_SIZE = canvas.width / GRID_SIZE;

// Environment state
let currentAlgorithm = 'qlearning';
let isTraining = false;
let animationSpeed = 40;
let agents = {};
let agent = null;
let environment = null;

// Statistics
let episodeCount = 0;
let successHistory = [];
let pathLengthHistory = [];
let successCount = 0;

// Charts
let successChart = null;
let pathChart = null;

// Drone Environment
class DroneEnvironment {
    constructor(size) {
        this.size = size;
        this.dronePos = { x: 0, y: 0 };
        this.destination = { x: size - 1, y: size - 1 };
        this.obstacles = this.generateObstacles();
        this.battery = 100;
        this.maxBattery = 100;
        this.batteryDrain = 1;
        this.steps = 0;
        this.maxSteps = 150;
        this.reset();
    }

    generateObstacles() {
        const obstacles = new Set();
        // Create random obstacles (about 8% of cells) - reduced
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                if (Math.random() < 0.08 && 
                    !(i === 0 && j === 0) && 
                    !(i === this.size - 1 && j === this.size - 1)) {
                    obstacles.add(`${i},${j}`);
                }
            }
        }
        return obstacles;
    }

    reset() {
        this.dronePos = { x: 0, y: 0 };
        this.battery = this.maxBattery;
        this.steps = 0;
        return this.getState();
    }

    getState() {
        // State includes position and battery level
        const batteryLevel = Math.floor(this.battery / 20); // 0-5
        return (this.dronePos.x * this.size + this.dronePos.y) * 6 + batteryLevel;
    }

    step(action) {
        this.steps++;
        
        // Actions: 0=up, 1=right, 2=down, 3=left, 4=stay
        const moves = [
            { x: -1, y: 0 },  // up
            { x: 0, y: 1 },   // right
            { x: 1, y: 0 },   // down
            { x: 0, y: -1 },  // left
            { x: 0, y: 0 }    // stay (hover)
        ];

        const move = moves[action];
        
        // Calculate old distance for reward shaping
        const oldDist = Math.abs(this.dronePos.x - this.destination.x) + 
                       Math.abs(this.dronePos.y - this.destination.y);
        
        const newX = this.dronePos.x + move.x;
        const newY = this.dronePos.y + move.y;

        let reward = -0.2; // Reduced base cost
        let collision = false;

        // Drain battery
        if (action === 4) {
            this.battery -= this.batteryDrain * 0.3; // Less drain for hovering
        } else {
            this.battery -= this.batteryDrain;
        }

        // Check boundaries and obstacles
        if (newX >= 0 && newX < this.size && newY >= 0 && newY < this.size) {
            if (!this.obstacles.has(`${newX},${newY}`)) {
                this.dronePos.x = newX;
                this.dronePos.y = newY;
                
                // Strong reward shaping for moving toward destination
                const newDist = Math.abs(this.dronePos.x - this.destination.x) + 
                               Math.abs(this.dronePos.y - this.destination.y);
                if (newDist < oldDist) {
                    reward += 2; // Strong reward for getting closer
                } else if (newDist > oldDist) {
                    reward -= 0.5; // Penalty for moving away
                }
            } else {
                collision = true;
                reward = -10; // Stronger penalty for hitting obstacle
            }
        } else {
            collision = true;
            reward = -10; // Stronger penalty for going out of bounds
        }

        let done = false;

        // Check if reached destination
        if (this.dronePos.x === this.destination.x && this.dronePos.y === this.destination.y) {
            reward = 10000 + this.battery * 0.5; // Much larger bonus for success (increased from 100)
            done = true;
        }

        // Check battery
        if (this.battery <= 0) {
            reward = -30; // Larger penalty for running out of battery
            done = true;
        }

        // Check max steps
        if (this.steps >= this.maxSteps) {
            reward = -15;
            done = true;
        }

        return {
            state: this.getState(),
            reward: reward,
            done: done,
            collision: collision
        };
    }

    render() {
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

        // Draw obstacles
        ctx.fillStyle = '#ef4444';
        this.obstacles.forEach(obstacle => {
            const [x, y] = obstacle.split(',').map(Number);
            ctx.fillRect(y * CELL_SIZE + 2, x * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
            
            // Warning stripes
            ctx.fillStyle = '#fca5a5';
            for (let i = 0; i < 5; i++) {
                ctx.fillRect(
                    y * CELL_SIZE + 2 + i * 10, 
                    x * CELL_SIZE + 2, 
                    5, 
                    CELL_SIZE - 4
                );
            }
            ctx.fillStyle = '#ef4444';
        });

        // Draw destination (landing pad)
        const destX = this.destination.y * CELL_SIZE + CELL_SIZE / 2;
        const destY = this.destination.x * CELL_SIZE + CELL_SIZE / 2;
        
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(destX, destY, CELL_SIZE / 2 - 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(destX - 15, destY);
        ctx.lineTo(destX + 15, destY);
        ctx.moveTo(destX, destY - 15);
        ctx.lineTo(destX, destY + 15);
        ctx.stroke();

        // Draw drone
        const droneX = this.dronePos.y * CELL_SIZE + CELL_SIZE / 2;
        const droneY = this.dronePos.x * CELL_SIZE + CELL_SIZE / 2;
        
        // Drone body
        ctx.fillStyle = this.battery < 20 ? '#f59e0b' : '#6366f1';
        ctx.beginPath();
        ctx.arc(droneX, droneY, CELL_SIZE / 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Propellers
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 3;
        const propellerRadius = CELL_SIZE / 4;
        
        for (let i = 0; i < 4; i++) {
            const angle = (Math.PI / 2) * i + Date.now() * 0.01;
            const px = droneX + Math.cos(angle) * propellerRadius;
            const py = droneY + Math.sin(angle) * propellerRadius;
            
            ctx.beginPath();
            ctx.arc(px, py, 4, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Battery indicator
        const batteryWidth = 60;
        const batteryHeight = 15;
        const batteryX = 10;
        const batteryY = canvas.height - 30;
        
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.strokeRect(batteryX, batteryY, batteryWidth, batteryHeight);
        
        const batteryFill = (this.battery / this.maxBattery) * (batteryWidth - 4);
        ctx.fillStyle = this.battery < 20 ? '#ef4444' : 
                       this.battery < 50 ? '#f59e0b' : '#10b981';
        ctx.fillRect(batteryX + 2, batteryY + 2, batteryFill, batteryHeight - 4);
        
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '12px Arial';
        ctx.fillText(`${Math.floor(this.battery)}%`, batteryX + batteryWidth + 10, batteryY + 12);
    }
}

// Initialize
function init() {
    environment = new DroneEnvironment(GRID_SIZE);
    
    const stateSpace = GRID_SIZE * GRID_SIZE * 6; // position * battery levels
    const actionSpace = 5;
    
    agents = {
        qlearning: new QLearningAgent(stateSpace, actionSpace, { alpha: 0.4, gamma: 0.95, epsilon: 1.0, epsilonDecay: 0.995, epsilonMin: 0.05 }),
        sarsa: new SARSAAgent(stateSpace, actionSpace, { alpha: 0.4, gamma: 0.95, epsilon: 1.0, epsilonDecay: 0.995, epsilonMin: 0.05 }),
        montecarlo: new MonteCarloAgent(stateSpace, actionSpace, { gamma: 0.95, epsilon: 1.0, epsilonDecay: 0.995, epsilonMin: 0.05 }),
        dqn: new DQNAgent(stateSpace, actionSpace, { alpha: 0.005 })
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

    successChart = new Chart(document.getElementById('successChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                label: 'Success Rate (%)',
                data: [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4
            }]
        }
    });

    pathChart = new Chart(document.getElementById('pathChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                label: 'Path Length',
                data: [],
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
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
        await new Promise(resolve => setTimeout(resolve, 5));
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
    let pathLength = 0;

    while (!done) {
        const action = agent.selectAction(state);
        const result = environment.step(action);
        
        agent.update(state, action, result.reward, result.state, result.done);
        
        state = result.state;
        done = result.done;
        pathLength++;
        
        environment.render();
        await new Promise(resolve => setTimeout(resolve, animationSpeed));
    }

    episodeCount++;
    
    // Decay epsilon after episode for Q-Learning and SARSA
    if (agent.decayEpsilon) {
        agent.decayEpsilon();
    }
    
    if (environment.dronePos.x === environment.destination.x && 
        environment.dronePos.y === environment.destination.y) {
        successCount++;
    }
    
    const windowSize = Math.min(episodeCount, 10);
    const recentSuccess = successHistory.slice(-windowSize).reduce((a, b) => a + b, 0);
    successHistory.push(environment.dronePos.x === environment.destination.x && 
                       environment.dronePos.y === environment.destination.y ? 100 : 0);
    
    pathLengthHistory.push(pathLength);

    updateStats();
    updateCharts();
}

function updateStats() {
    document.getElementById('episode').textContent = episodeCount;
    document.getElementById('battery').textContent = Math.floor(environment.battery) + '%';
    document.getElementById('distance').textContent = pathLengthHistory[pathLengthHistory.length - 1] || 0;
    document.getElementById('success').textContent = ((successCount / episodeCount) * 100).toFixed(1) + '%';
}

function updateCharts() {
    const maxPoints = 50;
    const start = Math.max(0, successHistory.length - maxPoints);
    
    // Calculate moving average for success rate
    const windowSize = 10;
    const movingAvg = [];
    for (let i = windowSize - 1; i < successHistory.length; i++) {
        const window = successHistory.slice(i - windowSize + 1, i + 1);
        movingAvg.push(window.reduce((a, b) => a + b, 0) / windowSize);
    }
    
    successChart.data.labels = Array.from({ length: movingAvg.length - Math.max(0, movingAvg.length - maxPoints) }, 
        (_, i) => Math.max(0, movingAvg.length - maxPoints) + i + windowSize);
    successChart.data.datasets[0].data = movingAvg.slice(Math.max(0, movingAvg.length - maxPoints));
    successChart.update('none');

    pathChart.data.labels = Array.from({ length: pathLengthHistory.length - start }, (_, i) => start + i + 1);
    pathChart.data.datasets[0].data = pathLengthHistory.slice(start);
    pathChart.update('none');
}

function resetEnvironment() {
    episodeCount = 0;
    successHistory = [];
    pathLengthHistory = [];
    successCount = 0;
    
    environment = new DroneEnvironment(GRID_SIZE);
    agents = {
        qlearning: new QLearningAgent(GRID_SIZE * GRID_SIZE * 6, 5, { alpha: 0.4, gamma: 0.95, epsilon: 1.0, epsilonDecay: 0.995, epsilonMin: 0.05 }),
        sarsa: new SARSAAgent(GRID_SIZE * GRID_SIZE * 6, 5, { alpha: 0.4, gamma: 0.95, epsilon: 1.0, epsilonDecay: 0.995, epsilonMin: 0.05 }),
        montecarlo: new MonteCarloAgent(GRID_SIZE * GRID_SIZE * 6, 5, { gamma: 0.95, epsilon: 1.0, epsilonDecay: 0.995, epsilonMin: 0.05 }),
        dqn: new DQNAgent(GRID_SIZE * GRID_SIZE * 6, 5, { alpha: 0.005 })
    };
    agent = agents[currentAlgorithm];
    
    updateStats();
    successChart.data.labels = [];
    successChart.data.datasets[0].data = [];
    successChart.update();
    pathChart.data.labels = [];
    pathChart.data.datasets[0].data = [];
    pathChart.update();
    
    environment.render();
}

window.addEventListener('load', init);

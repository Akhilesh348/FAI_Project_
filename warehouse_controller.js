// Warehouse Picker Robot Environment Controller
const canvas = document.getElementById('environment-canvas');
const ctx = canvas.getContext('2d');

// Configuration
const GRID_SIZE = 8;
const CELL_SIZE = canvas.width / GRID_SIZE;

// Environment state
let currentAlgorithm = 'qlearning';
let isTraining = false;
let animationSpeed = 35;
let agents = {};
let agent = null;
let environment = null;

// Statistics
let episodeCount = 0;
let itemsDeliveredHistory = [];
let efficiencyHistory = [];

// Charts
let itemsChart = null;
let efficiencyChart = null;

// Warehouse Environment
class WarehouseEnvironment {
    constructor(size) {
        this.size = size;
        this.robotPos = { x: 0, y: 0 };
        this.dropZone = { x: 0, y: 0 };
        this.items = [];
        this.numItems = 5;
        this.carrying = null;
        this.itemsDelivered = 0;
        this.steps = 0;
        this.maxSteps = 1000;
        this.shelves = this.generateShelves();
        this.reset();
    }

    generateShelves() {
        const shelves = new Set();
        // Create shelf layout - reduced density for smaller grid
        for (let i = 2; i < this.size - 1; i += 3) {
            for (let j = 2; j < this.size - 1; j += 3) {
                shelves.add(`${i},${j}`);
            }
        }
        return shelves;
    }

    reset() {
        this.robotPos = { x: 0, y: 0 };
        this.dropZone = { x: 0, y: 0 };
        this.carrying = null;
        this.itemsDelivered = 0;
        this.steps = 0;
        this.items = [];
        
        // Spawn items at random locations (not on shelves or drop zone)
        while (this.items.length < this.numItems) {
            const x = Math.floor(Math.random() * this.size);
            const y = Math.floor(Math.random() * this.size);
            const key = `${x},${y}`;
            
            if (!this.shelves.has(key) && !(x === 0 && y === 0) && 
                !this.items.some(item => item.x === x && item.y === y)) {
                this.items.push({ x, y, id: this.items.length });
            }
        }
        
        return this.getState();
    }

    getState() {
        // Simplified state: robot position, carrying status, nearest item
        const carryingState = this.carrying !== null ? 1 : 0;
        const robotState = this.robotPos.x * this.size + this.robotPos.y;
        return robotState * 2 + carryingState;
    }

    step(action) {
        this.steps++;
        
        // Actions: 0=up, 1=right, 2=down, 3=left, 4=pick, 5=drop
        let reward = -0.05; // Reduced step penalty
        
        // Calculate old distances for reward shaping
        let targetX, targetY;
        if (this.carrying === null && this.items.length > 0) {
            // Find nearest item
            let minDist = Infinity;
            for (const item of this.items) {
                const dist = Math.abs(this.robotPos.x - item.x) + Math.abs(this.robotPos.y - item.y);
                if (dist < minDist) {
                    minDist = dist;
                    targetX = item.x;
                    targetY = item.y;
                }
            }
        } else if (this.carrying !== null) {
            // Target is drop zone
            targetX = this.dropZone.x;
            targetY = this.dropZone.y;
        }
        
        const oldDist = targetX !== undefined ? 
            Math.abs(this.robotPos.x - targetX) + Math.abs(this.robotPos.y - targetY) : 0;
        
        if (action < 4) {
            // Movement
            const moves = [
                { x: -1, y: 0 },  // up
                { x: 0, y: 1 },   // right
                { x: 1, y: 0 },   // down
                { x: 0, y: -1 }   // left
            ];

            const move = moves[action];
            const newX = this.robotPos.x + move.x;
            const newY = this.robotPos.y + move.y;

            // Check boundaries and shelves
            if (newX >= 0 && newX < this.size && newY >= 0 && newY < this.size) {
                if (!this.shelves.has(`${newX},${newY}`)) {
                    this.robotPos.x = newX;
                    this.robotPos.y = newY;
                    
                    // // Reward shaping for moving toward target
                    // if (targetX !== undefined) {
                    //     const newDist = Math.abs(this.robotPos.x - targetX) + 
                    //                   Math.abs(this.robotPos.y - targetY);
                    //     if (newDist < oldDist) {
                    //         reward += 0.5; // Reward for getting closer
                    //     } else if (newDist > oldDist) {
                    //         reward -= 0.25; // Small penalty for moving away
                    //     }
                    // }
                    if (targetX !== undefined) {
                        const newDist = Math.abs(this.robotPos.x - targetX) + 
                            Math.abs(this.robotPos.y - targetY);
                        const distChange = oldDist - newDist;

                    // Stronger directional reward
                    if (distChange > 0) reward += 1.0 * distChange;      // Moving closer
                    else if (distChange < 0) reward -= 0.5 * (-distChange); // Moving away
}

                } else {
                    reward = -1; // Penalty for hitting shelf
                }
            }
        } else if (action === 4) {
            // Pick action
            if (this.carrying === null) {
                // Check if there's an item at current position
                const itemIndex = this.items.findIndex(
                    item => item.x === this.robotPos.x && item.y === this.robotPos.y
                );
                
                if (itemIndex !== -1) {
                    this.carrying = this.items[itemIndex];
                    this.items.splice(itemIndex, 1);
                    reward = 5; // Increased reward for picking
                } else {
                    reward = -0.5; // Penalty for trying to pick nothing
                }
            } else {
                reward = -0.5; // Penalty for trying to pick while carrying
            }
        } else if (action === 5) {
            // Drop action
            if (this.carrying !== null) {
                if (this.robotPos.x === this.dropZone.x && this.robotPos.y === this.dropZone.y) {
                    // Successfully delivered
                    this.carrying = null;
                    this.itemsDelivered++;
                    reward = 1000; // Much larger reward for delivery (increased from 20)
                } else {
                    // Dropped at wrong location
                    this.items.push({
                        x: this.robotPos.x,
                        y: this.robotPos.y,
                        id: this.carrying.id
                    });
                    this.carrying = null;
                    reward = -2; // Penalty for wrong drop
                }
            } else {
                reward = -0.5; // Penalty for dropping nothing
            }
        }

        let done = false;
        
        // Check if all items delivered
        if (this.itemsDelivered === this.numItems) {
            reward += 5000; // Large bonus for completing all deliveries (increased from 50)
            done = true;
        }
        
        // Check max steps
        if (this.steps >= this.maxSteps) {
            done = true;
        }

        return {
            state: this.getState(),
            reward: reward,
            done: done
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

        // Draw shelves
        ctx.fillStyle = '#4a4a5e';
        this.shelves.forEach(shelf => {
            const [x, y] = shelf.split(',').map(Number);
            ctx.fillRect(y * CELL_SIZE + 4, x * CELL_SIZE + 4, CELL_SIZE - 8, CELL_SIZE - 8);
            
            // Shelf details
            ctx.strokeStyle = '#6a6a7e';
            ctx.lineWidth = 2;
            ctx.strokeRect(y * CELL_SIZE + 6, x * CELL_SIZE + 6, CELL_SIZE - 12, CELL_SIZE - 12);
        });

        // Draw drop zone
        ctx.fillStyle = '#10b981';
        ctx.fillRect(
            this.dropZone.y * CELL_SIZE + 4,
            this.dropZone.x * CELL_SIZE + 4,
            CELL_SIZE - 8,
            CELL_SIZE - 8
        );
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📦', 
            this.dropZone.y * CELL_SIZE + CELL_SIZE / 2,
            this.dropZone.x * CELL_SIZE + CELL_SIZE / 2
        );

        // Draw items
        this.items.forEach(item => {
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(
                item.y * CELL_SIZE + CELL_SIZE / 2,
                item.x * CELL_SIZE + CELL_SIZE / 2,
                CELL_SIZE / 4,
                0,
                Math.PI * 2
            );
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Arial';
            ctx.fillText(item.id + 1, 
                item.y * CELL_SIZE + CELL_SIZE / 2,
                item.x * CELL_SIZE + CELL_SIZE / 2
            );
        });

        // Draw robot
        const robotX = this.robotPos.y * CELL_SIZE + CELL_SIZE / 2;
        const robotY = this.robotPos.x * CELL_SIZE + CELL_SIZE / 2;
        
        // Robot base
        ctx.fillStyle = this.carrying ? '#8b5cf6' : '#6366f1';
        ctx.beginPath();
        ctx.arc(robotX, robotY, CELL_SIZE / 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Robot details
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(robotX, robotY, CELL_SIZE / 3, 0, Math.PI * 2);
        ctx.stroke();
        
        // If carrying, show item
        if (this.carrying) {
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(robotX, robotY - CELL_SIZE / 3 - 8, 8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw stats overlay
        ctx.fillStyle = 'rgba(26, 26, 46, 0.8)';
        ctx.fillRect(canvas.width - 150, 10, 140, 60);
        
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Items: ${this.itemsDelivered}/${this.numItems}`, canvas.width - 140, 30);
        ctx.fillText(`Steps: ${this.steps}`, canvas.width - 140, 50);
    }
}

// Initialize
function init() {
    environment = new WarehouseEnvironment(GRID_SIZE);
    
    const stateSpace = GRID_SIZE * GRID_SIZE * 2; // position * carrying status
    const actionSpace = 6; // up, right, down, left, pick, drop
    
    agents = {
        qlearning: new QLearningAgent(stateSpace, actionSpace, { alpha: 0.4, gamma: 0.95, epsilon: 1.0, epsilonDecay: 0.995, epsilonMin: 0.05 }),
        sarsa: new SARSAAgent(stateSpace, actionSpace, { alpha: 0.4, gamma: 0.95, epsilon: 1.0, epsilonDecay: 0.995, epsilonMin: 0.05 }),
        montecarlo: new MonteCarloAgent(stateSpace, actionSpace, { gamma: 0.95, epsilon: 1.0, epsilonDecay: 0.995, epsilonMin: 0.05 }),
        dqn: new DQNAgent(stateSpace, actionSpace, { alpha: 0.01 })
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

    itemsChart = new Chart(document.getElementById('itemsChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                label: 'Items Delivered',
                data: [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4
            }]
        }
    });

    efficiencyChart = new Chart(document.getElementById('efficiencyChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                label: 'Steps per Item',
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
    itemsDeliveredHistory.push(environment.itemsDelivered);
    
    // Decay epsilon after episode for Q-Learning and SARSA
    if (agent.decayEpsilon) {
        agent.decayEpsilon();
    }
    
    const stepsPerItem = environment.itemsDelivered > 0 ? 
        environment.steps / environment.itemsDelivered : environment.maxSteps;
    efficiencyHistory.push(stepsPerItem);

    updateStats();
    updateCharts();
}

function updateStats() {
    document.getElementById('episode').textContent = episodeCount;
    document.getElementById('delivered').textContent = environment.itemsDelivered;
    document.getElementById('steps').textContent = environment.steps;
    
    const efficiency = environment.itemsDelivered / environment.numItems * 100;
    document.getElementById('efficiency').textContent = efficiency.toFixed(1) + '%';
}

function updateCharts() {
    const maxPoints = 50;
    const start = Math.max(0, itemsDeliveredHistory.length - maxPoints);
    
    itemsChart.data.labels = Array.from({ length: itemsDeliveredHistory.length - start }, (_, i) => start + i + 1);
    itemsChart.data.datasets[0].data = itemsDeliveredHistory.slice(start);
    itemsChart.update('none');

    efficiencyChart.data.labels = Array.from({ length: efficiencyHistory.length - start }, (_, i) => start + i + 1);
    efficiencyChart.data.datasets[0].data = efficiencyHistory.slice(start);
    efficiencyChart.update('none');
}

function resetEnvironment() {
    episodeCount = 0;
    itemsDeliveredHistory = [];
    efficiencyHistory = [];
    
    environment = new WarehouseEnvironment(GRID_SIZE);
    agents = {
        qlearning: new QLearningAgent(GRID_SIZE * GRID_SIZE * 2, 6, { alpha: 0.4, gamma: 0.95, epsilon: 1.0, epsilonDecay: 0.995, epsilonMin: 0.05 }),
        sarsa: new SARSAAgent(GRID_SIZE * GRID_SIZE * 2, 6, { alpha: 0.4, gamma: 0.95, epsilon: 1.0, epsilonDecay: 0.995, epsilonMin: 0.05 }),
        montecarlo: new MonteCarloAgent(GRID_SIZE * GRID_SIZE * 2, 6, { gamma: 0.95, epsilon: 1.0, epsilonDecay: 0.995, epsilonMin: 0.05 }),
        dqn: new DQNAgent(GRID_SIZE * GRID_SIZE * 2, 6, { alpha: 0.01 })
    };
    agent = agents[currentAlgorithm];
    
    updateStats();
    itemsChart.data.labels = [];
    itemsChart.data.datasets[0].data = [];
    itemsChart.update();
    efficiencyChart.data.labels = [];
    efficiencyChart.data.datasets[0].data = [];
    efficiencyChart.update();
    
    environment.render();
}

window.addEventListener('load', init);

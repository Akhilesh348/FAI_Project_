// Memory Management Environment Controller
const canvas = document.getElementById('environment-canvas');
const ctx = canvas.getContext('2d');

// Configuration
const MEMORY_SIZE = 16; // 16 memory units (representing MB or GB)
const CELL_WIDTH = canvas.width / MEMORY_SIZE;
const CELL_HEIGHT = canvas.height - 40;

// Environment state
let currentAlgorithm = 'qlearning';
let isTraining = false;
let animationSpeed = 50;
let agents = {};
let agent = null;
let environment = null;

// Statistics
let episodeCount = 0;
let rewardHistory = [];
let fragmentationHistory = [];
let successCount = 0;

// Charts
let rewardChart = null;
let fragmentationChart = null;

// Process types that request memory
const PROCESS_TYPES = [
    { name: 'Browser', minSize: 3, maxSize: 5, color: '#ef4444', lifetime: 8 },
    { name: 'IDE', minSize: 4, maxSize: 6, color: '#f59e0b', lifetime: 10 },
    { name: 'Video', minSize: 2, maxSize: 4, color: '#10b981', lifetime: 6 },
    { name: 'Game', minSize: 5, maxSize: 7, color: '#6366f1', lifetime: 12 },
    { name: 'Editor', minSize: 2, maxSize: 3, color: '#8b5cf6', lifetime: 5 }
];

// Real-time Memory Management Environment
class MemoryEnvironment {
    constructor(memorySize) {
        this.memorySize = memorySize;
        this.memory = new Array(memorySize).fill(null); // null = free
        this.processes = []; // Active processes
        this.nextProcessId = 0;
        this.timeStep = 0;
        this.maxTimeSteps = 100;
        this.allocationQueue = []; // Processes waiting for memory
        this.totalAllocated = 0;
        this.totalFailed = 0;
        this.totalFragmentation = 0;
        this.requestInterval = 3; // New request every N timesteps
        this.reset();
    }

    reset() {
        this.memory = new Array(this.memorySize).fill(null);
        this.processes = [];
        this.nextProcessId = 0;
        this.timeStep = 0;
        this.allocationQueue = [];
        this.totalAllocated = 0;
        this.totalFailed = 0;
        this.totalFragmentation = 0;
        
        // Start with some initial processes
        this.generateNewRequest();
        this.generateNewRequest();
        
        return this.getState();
    }

    generateNewRequest() {
        const processType = PROCESS_TYPES[Math.floor(Math.random() * PROCESS_TYPES.length)];
        const size = Math.floor(Math.random() * (processType.maxSize - processType.minSize + 1)) + processType.minSize;
        
        this.allocationQueue.push({
            id: this.nextProcessId++,
            name: `${processType.name}#${this.nextProcessId}`,
            size: size,
            color: processType.color,
            lifetime: processType.lifetime,
            age: 0,
            priority: Math.random() < 0.3 ? 'high' : 'normal' // 30% high priority
        });
    }

    getState() {
        // State encoding: memory occupancy pattern + queue size + fragmentation
        let memoryPattern = 0;
        for (let i = 0; i < this.memorySize; i++) {
            memoryPattern = memoryPattern * 2 + (this.memory[i] !== null ? 1 : 0);
        }
        
        const queueSize = Math.min(this.allocationQueue.length, 5);
        const fragmentation = this.calculateFragmentation();
        
        return (memoryPattern % 10000) * 10 + queueSize;
    }

    calculateFragmentation() {
        // Count number of free memory fragments
        let fragments = 0;
        let inFreeBlock = false;
        
        for (let i = 0; i < this.memorySize; i++) {
            if (this.memory[i] === null) {
                if (!inFreeBlock) {
                    fragments++;
                    inFreeBlock = true;
                }
            } else {
                inFreeBlock = false;
            }
        }
        
        return fragments;
    }

    getFreeBlocks() {
        // Get all contiguous free blocks
        const blocks = [];
        let start = -1;
        
        for (let i = 0; i <= this.memorySize; i++) {
            if (i < this.memorySize && this.memory[i] === null) {
                if (start === -1) start = i;
            } else {
                if (start !== -1) {
                    blocks.push({ start: start, size: i - start });
                    start = -1;
                }
            }
        }
        
        return blocks;
    }

    step(action) {
        // Actions:
        // 0-2: Allocation strategy (first-fit, best-fit, worst-fit)
        // 3: Compact memory (defragmentation)
        // 4: Reject current request (if queue is not empty)
        
        this.timeStep++;
        let reward = 0;
        
        // Age processes and remove expired ones
        for (let i = this.processes.length - 1; i >= 0; i--) {
            this.processes[i].age++;
            if (this.processes[i].age >= this.processes[i].lifetime) {
                // Process completed, free its memory
                this.deallocateProcess(this.processes[i].id);
                this.processes.splice(i, 1);
                reward += 0.5; // Small reward for natural deallocation
            }
        }
        
        // Execute action
        if (action === 3) {
            // Compact/defragment memory
            const beforeFrag = this.calculateFragmentation();
            this.compactMemory();
            const afterFrag = this.calculateFragmentation();
            
            reward += (beforeFrag - afterFrag) * 3; // Reward for reducing fragmentation
            reward -= 2; // Cost of compaction (CPU overhead)
        } else if (action === 4 && this.allocationQueue.length > 0) {
            // Reject current request
            const rejected = this.allocationQueue.shift();
            this.totalFailed++;
            reward -= rejected.priority === 'high' ? 10 : 3; // High penalty for rejecting high priority
        } else if (this.allocationQueue.length > 0) {
            // Try to allocate using specified strategy
            const request = this.allocationQueue[0];
            const allocated = this.allocateProcess(request, action);
            
            if (allocated) {
                this.allocationQueue.shift();
                this.totalAllocated++;
                reward += request.priority === 'high' ? 15 : 8; // High reward for successful allocation
                reward += (this.memorySize - request.size) * 0.2; // Bonus for efficient use
            } else {
                reward -= 2; // Penalty for failed allocation attempt
            }
        }
        
        // Penalize fragmentation
        const fragmentation = this.calculateFragmentation();
        this.totalFragmentation += fragmentation;
        reward -= fragmentation * 0.5;
        
        // Penalize waiting queue
        reward -= this.allocationQueue.length * 0.3;
        
        // Generate new requests periodically
        if (this.timeStep % this.requestInterval === 0 && this.timeStep < this.maxTimeSteps - 10) {
            this.generateNewRequest();
            if (Math.random() < 0.3) this.generateNewRequest(); // Burst requests
        }
        
        // Check termination
        const done = this.timeStep >= this.maxTimeSteps;
        
        if (done) {
            // Final evaluation
            const successRate = this.totalAllocated / (this.totalAllocated + this.totalFailed + 0.001);
            reward += successRate * 50; // Reward for high success rate
            reward -= this.allocationQueue.length * 5; // Penalty for remaining requests
        }
        
        return {
            state: this.getState(),
            reward: reward,
            done: done
        };
    }

    allocateProcess(request, strategy) {
        // 0: First-fit, 1: Best-fit, 2: Worst-fit
        const freeBlocks = this.getFreeBlocks();
        const suitableBlocks = freeBlocks.filter(b => b.size >= request.size);
        
        if (suitableBlocks.length === 0) return false;
        
        let chosenBlock;
        
        if (strategy === 0) {
            // First-fit: first block that fits
            chosenBlock = suitableBlocks[0];
        } else if (strategy === 1) {
            // Best-fit: smallest block that fits
            chosenBlock = suitableBlocks.reduce((best, curr) => 
                curr.size < best.size ? curr : best
            );
        } else {
            // Worst-fit: largest block
            chosenBlock = suitableBlocks.reduce((worst, curr) => 
                curr.size > worst.size ? curr : worst
            );
        }
        
        // Allocate memory
        for (let i = chosenBlock.start; i < chosenBlock.start + request.size; i++) {
            this.memory[i] = request.id;
        }
        
        this.processes.push({
            ...request,
            startAddress: chosenBlock.start
        });
        
        return true;
    }

    deallocateProcess(processId) {
        for (let i = 0; i < this.memorySize; i++) {
            if (this.memory[i] === processId) {
                this.memory[i] = null;
            }
        }
    }

    compactMemory() {
        // Move all allocated blocks to the left, eliminating fragmentation
        const newMemory = new Array(this.memorySize).fill(null);
        let writePos = 0;
        
        // Collect all processes in order
        const allocatedBlocks = [];
        for (const proc of this.processes) {
            allocatedBlocks.push({
                processId: proc.id,
                size: proc.size
            });
        }
        
        // Rewrite memory compacted
        for (const block of allocatedBlocks) {
            for (let i = 0; i < block.size; i++) {
                newMemory[writePos++] = block.processId;
            }
        }
        
        this.memory = newMemory;
        
        // Update process start addresses
        let pos = 0;
        for (const proc of this.processes) {
            proc.startAddress = pos;
            pos += proc.size;
        }
    }

    render() {
        // Clear canvas
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw memory grid
        ctx.strokeStyle = '#2a2a3e';
        ctx.lineWidth = 1;
        for (let i = 0; i <= this.memorySize; i++) {
            ctx.beginPath();
            ctx.moveTo(i * CELL_WIDTH, 0);
            ctx.lineTo(i * CELL_WIDTH, canvas.height - 40);
            ctx.stroke();
        }

        // Draw memory blocks
        for (let i = 0; i < this.memorySize; i++) {
            const processId = this.memory[i];
            if (processId !== null) {
                const proc = this.processes.find(p => p.id === processId);
                if (proc) {
                    const x = i * CELL_WIDTH + 2;
                    const y = 10;
                    const width = CELL_WIDTH - 4;
                    const height = CELL_HEIGHT;

                    // Process block
                    ctx.fillStyle = proc.color;
                    ctx.fillRect(x, y, width, height);

                    // Border
                    ctx.strokeStyle = proc.priority === 'high' ? '#ffffff' : '#222';
                    ctx.lineWidth = proc.priority === 'high' ? 3 : 1;
                    ctx.strokeRect(x, y, width, height);
                    
                    // Only draw label at start of process block
                    if (i === proc.startAddress) {
                        ctx.fillStyle = '#fff';
                        ctx.font = '10px Segoe UI';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'top';
                        ctx.fillText(proc.name.substring(0, 8), x + (width * proc.size / 2), y + 5);
                        
                        // Lifetime bar
                        const lifetimePercent = proc.age / proc.lifetime;
                        const barHeight = 4;
                        const barY = y + height - barHeight - 5;
                        ctx.fillStyle = 'rgba(255,255,255,0.2)';
                        ctx.fillRect(x, barY, width * proc.size - 4, barHeight);
                        ctx.fillStyle = lifetimePercent > 0.7 ? '#ef4444' : '#10b981';
                        ctx.fillRect(x, barY, (width * proc.size - 4) * lifetimePercent, barHeight);
                    }
                }
            } else {
                // Free memory
                ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
                ctx.fillRect(i * CELL_WIDTH + 2, 10, CELL_WIDTH - 4, CELL_HEIGHT);
            }
        }

        // Draw memory addresses
        ctx.fillStyle = '#6b7280';
        ctx.font = '10px Segoe UI';
        ctx.textAlign = 'center';
        for (let i = 0; i < this.memorySize; i++) {
            if (i % 2 === 0) {
                ctx.fillText(i.toString(), i * CELL_WIDTH + CELL_WIDTH / 2, canvas.height - 25);
            }
        }

        // Draw waiting queue
        const queueY = canvas.height - 15;
        ctx.fillStyle = '#a0a0b0';
        ctx.font = '12px Segoe UI';
        ctx.textAlign = 'left';
        ctx.fillText(`Queue: ${this.allocationQueue.length} | Allocated: ${this.totalAllocated} | Failed: ${this.totalFailed} | Frag: ${this.calculateFragmentation()}`, 5, queueY);
        
        // Show next request info
        if (this.allocationQueue.length > 0) {
            const next = this.allocationQueue[0];
            ctx.fillStyle = next.color;
            ctx.fillText(`Next: ${next.name} (${next.size} units) ${next.priority === 'high' ? '⚡' : ''}`, 380, queueY);
        }
        
        // Time indicator
        ctx.fillStyle = '#6b7280';
        ctx.textAlign = 'right';
        ctx.fillText(`Time: ${this.timeStep}/${this.maxTimeSteps}`, canvas.width - 5, queueY);
    }
}

// Initialize
function init() {
    environment = new MemoryEnvironment(MEMORY_SIZE);
    
    // Initialize agents
    const stateSpace = 100000; // Large state space for memory patterns
    const actionSpace = 5; // 0: first-fit, 1: best-fit, 2: worst-fit, 3: compact, 4: reject
    
    agents = {
        qlearning: new QLearningAgent(stateSpace, actionSpace, { 
            alpha: 0.4, 
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.997,
            epsilonMin: 0.1
        }),
        sarsa: new SARSAAgent(stateSpace, actionSpace, { 
            alpha: 0.4, 
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.997,
            epsilonMin: 0.1
        }),
        montecarlo: new MonteCarloAgent(stateSpace, actionSpace, {
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.997,
            epsilonMin: 0.1
        }),
        dqn: new DQNAgent(stateSpace, actionSpace, { alpha: 0.003 })
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
                tension: 0.4,
                fill: true
            }]
        }
    });

    fragmentationChart = new Chart(document.getElementById('movesChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                label: 'Avg Fragmentation',
                data: [],
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.4,
                fill: true
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
    document.getElementById('speedValue').textContent = value;
}

async function startTraining() {
    isTraining = true;
    document.getElementById('trainBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;

    while (isTraining && episodeCount < 1000) {
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
    let totalReward = 0;
    let totalFragmentation = 0;
    let steps = 0;

    while (steps < environment.maxTimeSteps) {
        // Get action from agent
        const action = agent.selectAction(state);

        // Take step in environment
        const result = environment.step(action);
        
        // Update agent
        agent.update(state, action, result.reward, result.state, result.done);
        
        // Update state
        state = result.state;
        totalReward += result.reward;
        totalFragmentation += environment.calculateFragmentation();
        steps++;

        // Render
        environment.render();
        await new Promise(resolve => setTimeout(resolve, animationSpeed));

        if (result.done) {
            const successRate = environment.totalAllocated / (environment.totalAllocated + environment.totalFailed + 0.001);
            if (successRate > 0.7) {
                successCount++;
            }
            break;
        }
    }

    // Update statistics
    episodeCount++;
    rewardHistory.push(totalReward);
    const avgFragmentation = totalFragmentation / steps;
    fragmentationHistory.push(avgFragmentation);
    
    // Decay epsilon
    if (agent.decayEpsilon) {
        agent.decayEpsilon();
    }

    updateStats();
    updateCharts();
}

function updateStats() {
    document.getElementById('episode').textContent = episodeCount;
    document.getElementById('reward').textContent = rewardHistory[rewardHistory.length - 1]?.toFixed(2) || 0;
    document.getElementById('moves').textContent = fragmentationHistory[fragmentationHistory.length - 1]?.toFixed(2) || 0;
    document.getElementById('success').textContent = ((successCount / episodeCount) * 100).toFixed(1) + '%';
}

function updateCharts() {
    const maxPoints = 50;
    const start = Math.max(0, rewardHistory.length - maxPoints);
    
    rewardChart.data.labels = Array.from({ length: rewardHistory.length - start }, (_, i) => start + i + 1);
    rewardChart.data.datasets[0].data = rewardHistory.slice(start);
    rewardChart.update('none');

    fragmentationChart.data.labels = Array.from({ length: fragmentationHistory.length - start }, (_, i) => start + i + 1);
    fragmentationChart.data.datasets[0].data = fragmentationHistory.slice(start);
    fragmentationChart.update('none');
}

function resetEnvironment() {
    episodeCount = 0;
    rewardHistory = [];
    fragmentationHistory = [];
    successCount = 0;
    
    environment = new MemoryEnvironment(MEMORY_SIZE);
    agents = {
        qlearning: new QLearningAgent(100000, 5, { 
            alpha: 0.4, 
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.997,
            epsilonMin: 0.1
        }),
        sarsa: new SARSAAgent(100000, 5, { 
            alpha: 0.4, 
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.997,
            epsilonMin: 0.1
        }),
        montecarlo: new MonteCarloAgent(100000, 5, {
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.997,
            epsilonMin: 0.1
        }),
        dqn: new DQNAgent(100000, 5, { alpha: 0.003 })
    };
    agent = agents[currentAlgorithm];
    
    updateStats();
    rewardChart.data.labels = [];
    rewardChart.data.datasets[0].data = [];
    rewardChart.update();
    fragmentationChart.data.labels = [];
    fragmentationChart.data.datasets[0].data = [];
    fragmentationChart.update();
    
    environment.render();
}

// Initialize on load
window.addEventListener('load', init);

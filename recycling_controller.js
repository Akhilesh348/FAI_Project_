// Recycling Separator Environment Controller
const canvas = document.getElementById('environment-canvas');
const ctx = canvas.getContext('2d');

// Configuration
const BIN_CAPACITY = 4;
const NUM_BINS = 5; // 3 for sorting + 2 empty for temporary storage
const BIN_WIDTH = 140;
const BIN_HEIGHT = 400;
const BIN_SPACING = 40;
const ITEM_HEIGHT = 70;

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
let movesHistory = [];
let successCount = 0;

// Charts
let rewardChart = null;
let movesChart = null;

// Waste categories
const CATEGORIES = {
    PAPER: { name: 'Paper', color: '#3b82f6', items: ['📰', '📦', '✉️', '📔'] },
    PLASTIC: { name: 'Plastic', color: '#ef4444', items: ['🍾', '🥤', '🎁', '🥛'] },
    METAL: { name: 'Metal', color: '#f59e0b', items: ['🥫', '📎', '🔩', '⚙️'] }
};

// Recycling Separator Environment
class RecyclingEnvironment {
    constructor(numBins, binCapacity) {
        this.numBins = numBins;
        this.binCapacity = binCapacity;
        this.bins = [];
        this.moves = 0;
        this.maxMoves = 200;
        this.reset();
    }

    reset() {
        this.bins = [];
        this.moves = 0;
        
        // Create bins with mixed items
        const categories = Object.keys(CATEGORIES);
        const allItems = [];
        
        // Generate 4 items of each category (12 items total)
        for (const cat of categories) {
            for (let i = 0; i < 4; i++) {
                allItems.push(cat);
            }
        }
        
        // Shuffle items
        for (let i = allItems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
        }
        
        // Fill first 3 bins with mixed items
        for (let b = 0; b < 3; b++) {
            const bin = [];
            for (let i = 0; i < this.binCapacity; i++) {
                bin.push(allItems[b * this.binCapacity + i]);
            }
            this.bins.push(bin);
        }
        
        // Add 2 empty bins for temporary storage
        for (let b = 0; b < 2; b++) {
            this.bins.push([]);
        }
        
        return this.getState();
    }

    getState() {
        // Encode state: top item of each bin + bin sizes
        let state = 0;
        const catMap = { 'PAPER': 1, 'PLASTIC': 2, 'METAL': 3 };
        
        for (const bin of this.bins) {
            const topItem = bin.length > 0 ? catMap[bin[bin.length - 1]] : 0;
            const size = bin.length;
            state = state * 20 + topItem * 5 + size;
        }
        
        return state % 1000000;
    }

    canMove(fromBin, toBin) {
        // Check if move is valid
        if (fromBin === toBin) return false;
        if (fromBin < 0 || fromBin >= this.numBins) return false;
        if (toBin < 0 || toBin >= this.numBins) return false;
        if (this.bins[fromBin].length === 0) return false;
        if (this.bins[toBin].length >= this.binCapacity) return false;
        
        // Check category matching
        const itemToMove = this.bins[fromBin][this.bins[fromBin].length - 1];
        const targetBin = this.bins[toBin];
        
        if (targetBin.length === 0) return true; // Can move to empty bin
        
        const topOfTarget = targetBin[targetBin.length - 1];
        return itemToMove === topOfTarget; // Can only move if categories match
    }

    step(action) {
        // Actions: fromBin * numBins + toBin (25 possible actions for 5 bins)
        const fromBin = Math.floor(action / this.numBins);
        const toBin = action % this.numBins;
        
        this.moves++;
        let reward = -0.1; // Small step penalty
        
        if (!this.canMove(fromBin, toBin)) {
            return {
                state: this.getState(),
                reward: -5, // Invalid move penalty
                done: false
            };
        }
        
        // Execute move
        const item = this.bins[fromBin].pop();
        this.bins[toBin].push(item);
        
        // Calculate reward based on progress
        const purityScore = this.calculatePurity();
        const sortedBins = this.countSortedBins();
        
        // Reward for creating pure bins
        reward += sortedBins * 10;
        
        // Reward for increasing purity
        reward += purityScore * 0.5;
        
        // Check if puzzle is solved
        let done = false;
        if (sortedBins >= 3) {
            reward += 10000; // Large bonus for solving
            done = true;
        } else if (this.moves >= this.maxMoves) {
            reward -= 20; // Timeout penalty
            done = true;
        }
        
        return {
            state: this.getState(),
            reward: reward,
            done: done
        };
    }

    calculatePurity() {
        // Calculate how "pure" each bin is (0-1)
        let totalPurity = 0;
        
        for (const bin of this.bins) {
            if (bin.length === 0) continue;
            
            const categories = {};
            for (const item of bin) {
                categories[item] = (categories[item] || 0) + 1;
            }
            
            const maxCount = Math.max(...Object.values(categories));
            const purity = maxCount / bin.length;
            totalPurity += purity;
        }
        
        return totalPurity;
    }

    countSortedBins() {
        // Count bins that contain only one category and are full (or pure)
        let sorted = 0;
        
        for (const bin of this.bins) {
            if (bin.length === 0) continue;
            
            const categories = new Set(bin);
            if (categories.size === 1 && bin.length === this.binCapacity) {
                sorted++;
            }
        }
        
        return sorted;
    }

    isSolved() {
        return this.countSortedBins() >= 3;
    }

    render() {
        // Clear canvas
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const startX = 50;
        const startY = 50;
        
        // Draw bins
        for (let b = 0; b < this.numBins; b++) {
            const x = startX + b * (BIN_WIDTH + BIN_SPACING);
            const y = startY;
            
            // Bin container
            ctx.strokeStyle = '#3a3a4e';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, BIN_WIDTH, BIN_HEIGHT);
            
            // Bin label
            ctx.fillStyle = '#a0a0b0';
            ctx.font = '14px Segoe UI';
            ctx.textAlign = 'center';
            const label = b < 3 ? `Bin ${b + 1}` : `Temp ${b - 2}`;
            ctx.fillText(label, x + BIN_WIDTH / 2, y - 10);
            
            // Capacity indicator
            ctx.fillStyle = '#6b7280';
            ctx.font = '12px Segoe UI';
            ctx.fillText(`${this.bins[b].length}/${this.binCapacity}`, x + BIN_WIDTH / 2, y + BIN_HEIGHT + 20);
            
            // Draw items in bin (from bottom to top)
            for (let i = 0; i < this.bins[b].length; i++) {
                const item = this.bins[b][i];
                const itemY = y + BIN_HEIGHT - (i + 1) * ITEM_HEIGHT - 10;
                
                // Item background
                const category = CATEGORIES[item];
                ctx.fillStyle = category.color;
                ctx.fillRect(x + 10, itemY, BIN_WIDTH - 20, ITEM_HEIGHT - 10);
                
                // Item border
                ctx.strokeStyle = '#222';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 10, itemY, BIN_WIDTH - 20, ITEM_HEIGHT - 10);
                
                // Item icon
                const icon = category.items[Math.floor(Math.random() * category.items.length)];
                ctx.font = '30px Segoe UI';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(icon, x + BIN_WIDTH / 2, itemY + (ITEM_HEIGHT - 10) / 2);
                
                // Category name
                ctx.fillStyle = '#fff';
                ctx.font = '11px Segoe UI';
                ctx.fillText(category.name, x + BIN_WIDTH / 2, itemY + ITEM_HEIGHT - 20);
            }
            
            // Check if bin is sorted
            if (this.bins[b].length > 0) {
                const categories = new Set(this.bins[b]);
                if (categories.size === 1 && this.bins[b].length === this.binCapacity) {
                    // Draw checkmark
                    ctx.fillStyle = '#10b981';
                    ctx.font = 'bold 40px Segoe UI';
                    ctx.fillText('✓', x + BIN_WIDTH / 2, y - 45);
                }
            }
        }
        
        // Draw legend
        const legendY = canvas.height - 30;
        let legendX = 50;
        
        ctx.font = '14px Segoe UI';
        ctx.textAlign = 'left';
        
        for (const [key, cat] of Object.entries(CATEGORIES)) {
            ctx.fillStyle = cat.color;
            ctx.fillRect(legendX, legendY, 20, 20);
            ctx.fillStyle = '#a0a0b0';
            ctx.fillText(cat.name, legendX + 25, legendY + 15);
            legendX += 120;
        }
        
        // Draw stats
        ctx.fillStyle = '#a0a0b0';
        ctx.font = '14px Segoe UI';
        ctx.textAlign = 'right';
        ctx.fillText(`Moves: ${this.moves} | Sorted: ${this.countSortedBins()}/3`, canvas.width - 20, legendY + 15);
    }
}

// Initialize
function init() {
    environment = new RecyclingEnvironment(NUM_BINS, BIN_CAPACITY);
    
    // Initialize agents
    const stateSpace = 1000000;
    const actionSpace = NUM_BINS * NUM_BINS; // 25 actions (5x5)
    
    agents = {
        qlearning: new QLearningAgent(stateSpace, actionSpace, { 
            alpha: 0.3, 
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.995,
            epsilonMin: 0.05
        }),
        sarsa: new SARSAAgent(stateSpace, actionSpace, { 
            alpha: 0.3, 
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.995,
            epsilonMin: 0.05
        }),
        montecarlo: new MonteCarloAgent(stateSpace, actionSpace, {
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.995,
            epsilonMin: 0.05
        }),
        dqn: new DQNAgent(stateSpace, actionSpace, { alpha: 0.005 })
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

    movesChart = new Chart(document.getElementById('movesChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                label: 'Moves',
                data: [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
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

    while (isTraining && episodeCount < 500) {
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
    let moves = 0;

    while (moves < environment.maxMoves) {
        // Get action from agent
        const action = agent.selectAction(state);

        // Take step in environment
        const result = environment.step(action);
        
        // Update agent
        agent.update(state, action, result.reward, result.state, result.done);
        
        // Update state
        state = result.state;
        totalReward += result.reward;
        moves++;

        // Render
        environment.render();
        await new Promise(resolve => setTimeout(resolve, animationSpeed));

        if (result.done) {
            if (environment.isSolved()) {
                successCount++;
            }
            break;
        }
    }

    // Update statistics
    episodeCount++;
    rewardHistory.push(totalReward);
    movesHistory.push(moves);
    
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
    document.getElementById('moves').textContent = movesHistory[movesHistory.length - 1] || 0;
    document.getElementById('success').textContent = ((successCount / episodeCount) * 100).toFixed(1) + '%';
}

function updateCharts() {
    const maxPoints = 50;
    const start = Math.max(0, rewardHistory.length - maxPoints);
    
    rewardChart.data.labels = Array.from({ length: rewardHistory.length - start }, (_, i) => start + i + 1);
    rewardChart.data.datasets[0].data = rewardHistory.slice(start);
    rewardChart.update('none');

    movesChart.data.labels = Array.from({ length: movesHistory.length - start }, (_, i) => start + i + 1);
    movesChart.data.datasets[0].data = movesHistory.slice(start);
    movesChart.update('none');
}

function resetEnvironment() {
    episodeCount = 0;
    rewardHistory = [];
    movesHistory = [];
    successCount = 0;
    
    environment = new RecyclingEnvironment(NUM_BINS, BIN_CAPACITY);
    agents = {
        qlearning: new QLearningAgent(1000000, 25, { 
            alpha: 0.3, 
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.995,
            epsilonMin: 0.05
        }),
        sarsa: new SARSAAgent(1000000, 25, { 
            alpha: 0.3, 
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.995,
            epsilonMin: 0.05
        }),
        montecarlo: new MonteCarloAgent(1000000, 25, {
            gamma: 0.95,
            epsilon: 1.0,
            epsilonDecay: 0.995,
            epsilonMin: 0.05
        }),
        dqn: new DQNAgent(1000000, 25, { alpha: 0.005 })
    };
    agent = agents[currentAlgorithm];
    
    updateStats();
    rewardChart.data.labels = [];
    rewardChart.data.datasets[0].data = [];
    rewardChart.update();
    movesChart.data.labels = [];
    movesChart.data.datasets[0].data = [];
    movesChart.update();
    
    environment.render();
}

// Initialize on load
window.addEventListener('load', init);

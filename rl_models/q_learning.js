// Q-Learning Agent Implementation
class QLearningAgent {
    constructor(stateSpace, actionSpace, options = {}) {
        this.stateSpace = stateSpace;
        this.actionSpace = actionSpace;
        
        // Hyperparameters - More aggressive learning
        this.alpha = options.alpha || 0.3;      // Learning rate (increased from 0.1)
        this.gamma = options.gamma || 0.95;     // Discount factor (reduced for faster convergence)
        this.epsilon = options.epsilon || 1.0;  // Exploration rate
        this.epsilonDecay = options.epsilonDecay || 0.99; // Faster decay (was 0.995)
        this.epsilonMin = options.epsilonMin || 0.05; // Higher minimum (was 0.01)
        
        // Q-table: Q(s, a)
        this.qTable = {};
        this.initQTable();
    }

    initQTable() {
        // Initialize with sparse representation for large state spaces
        this.qTable = {};
    }

    selectAction(state, training = true) {
        // Ensure state exists in Q-table
        if (!this.qTable[state]) {
            this.qTable[state] = new Array(this.actionSpace).fill(0);
        }
        
        // Epsilon-greedy policy
        if (training && Math.random() < this.epsilon) {
            return Math.floor(Math.random() * this.actionSpace);
        }
        
        // Greedy action with tie-breaking
        const qValues = this.qTable[state];
        const maxQ = Math.max(...qValues);
        const bestActions = [];
        for (let a = 0; a < this.actionSpace; a++) {
            if (qValues[a] === maxQ) bestActions.push(a);
        }
        return bestActions[Math.floor(Math.random() * bestActions.length)];
    }

    update(state, action, reward, nextState, done) {
        // Q-Learning update rule (off-policy)
        // Q(s,a) ← Q(s,a) + α[r + γ max Q(s',a') - Q(s,a)]
        
        // Ensure states exist in Q-table
        if (!this.qTable[state]) {
            this.qTable[state] = new Array(this.actionSpace).fill(0);
        }
        if (!this.qTable[nextState]) {
            this.qTable[nextState] = new Array(this.actionSpace).fill(0);
        }
        
        const currentQ = this.qTable[state][action];
        const maxNextQ = done ? 0 : Math.max(...this.qTable[nextState]);
        
        const target = reward + this.gamma * maxNextQ;
        const newQ = currentQ + this.alpha * (target - currentQ);
        
        this.qTable[state][action] = newQ;
    }
    
    // Get best action without exploration (for showing learned policy)
    getBestAction(state) {
        // Ensure state exists in Q-table
        if (!this.qTable[state]) {
            this.qTable[state] = new Array(this.actionSpace).fill(0);
        }
        
        // Get greedy action (no exploration)
        const qValues = this.qTable[state];
        const maxQ = Math.max(...qValues);
        const bestActions = [];
        for (let a = 0; a < this.actionSpace; a++) {
            if (qValues[a] === maxQ) bestActions.push(a);
        }
        return bestActions[Math.floor(Math.random() * bestActions.length)];
    }
    
    decayEpsilon() {
        // Decay epsilon after each episode
        this.epsilon = Math.max(this.epsilonMin, this.epsilon * this.epsilonDecay);
    }

    getQValue(state, action) {
        if (!this.qTable[state]) return 0;
        return this.qTable[state][action];
    }

    reset() {
        this.epsilon = 1.0;
        this.initQTable();
    }
}

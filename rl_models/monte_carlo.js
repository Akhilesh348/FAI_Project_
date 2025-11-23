// Monte Carlo Agent Implementation
// First-visit Monte Carlo method

class MonteCarloAgent {
    constructor(stateSpace, actionSpace, options = {}) {
        this.stateSpace = stateSpace;
        this.actionSpace = actionSpace;
        
        // Hyperparameters - More aggressive learning
        this.gamma = options.gamma || 0.95;     // Discount factor (reduced for faster convergence)
        this.epsilon = options.epsilon || 1.0;  // Exploration rate
        this.epsilonDecay = options.epsilonDecay || 0.99; // Faster decay (was 0.998)
        this.epsilonMin = options.epsilonMin || 0.05; // Keep same minimum
        
        // Q-values and visit counts
        this.qTable = {};
        this.returns = {}; // Store returns for each state-action pair
        this.visits = {};  // Track visits for first-visit MC
        
        // Episode memory
        this.episodeStates = [];
        this.episodeActions = [];
        this.episodeRewards = [];
        
        this.initQTable();
    }

    initQTable() {
        // Initialize with optimistic values to encourage exploration
        for (let s = 0; s < this.stateSpace; s++) {
            this.qTable[s] = new Array(this.actionSpace).fill(0);
            this.returns[s] = new Array(this.actionSpace).fill(null).map(() => []);
            this.visits[s] = new Set();
        }
    }

    selectAction(state, training = true) {
        // Ensure state exists in Q-table
        if (!this.qTable[state]) {
            this.qTable[state] = new Array(this.actionSpace).fill(0);
            this.returns[state] = new Array(this.actionSpace).fill(null).map(() => []);
            this.visits[state] = new Set();
        }
        
        // Epsilon-greedy policy
        if (training && Math.random() < this.epsilon) {
            return Math.floor(Math.random() * this.actionSpace);
        }
        
        // Greedy action selection
        const qValues = this.qTable[state];
        const maxQ = Math.max(...qValues);
        
        // Handle ties by random selection among best actions
        const bestActions = [];
        for (let a = 0; a < this.actionSpace; a++) {
            if (qValues[a] === maxQ) {
                bestActions.push(a);
            }
        }
        
        return bestActions[Math.floor(Math.random() * bestActions.length)];
    }

    update(state, action, reward, nextState, done) {
        // Store experience for current step
        this.episodeStates.push(state);
        this.episodeActions.push(action);
        this.episodeRewards.push(reward);
        
        // Update Q-values at end of episode (Monte Carlo)
        if (done) {
            this.updateQValues();
            
            // Clear episode memory
            this.episodeStates = [];
            this.episodeActions = [];
            this.episodeRewards = [];
            
            // Decay epsilon
            this.epsilon = Math.max(this.epsilonMin, this.epsilon * this.epsilonDecay);
        }
    }

    updateQValues() {
        // Calculate returns for each step (working backwards)
        let G = 0; // Return
        const episodeLength = this.episodeStates.length;
        
        // Track visited state-action pairs in this episode
        const visitedInEpisode = new Set();
        
        // Process episode in reverse (from terminal state to initial state)
        for (let t = episodeLength - 1; t >= 0; t--) {
            const state = this.episodeStates[t];
            const action = this.episodeActions[t];
            const reward = this.episodeRewards[t];
            
            // Calculate return
            G = reward + this.gamma * G;
            
            // First-visit MC: only update if this is the first visit to (s,a)
            const stateActionKey = `${state}-${action}`;
            if (!visitedInEpisode.has(stateActionKey)) {
                visitedInEpisode.add(stateActionKey);
                
                // Ensure state exists
                if (!this.returns[state]) {
                    this.returns[state] = new Array(this.actionSpace).fill(null).map(() => []);
                }
                
                // Store return
                this.returns[state][action].push(G);
                
                // Update Q-value as average of returns
                const returns = this.returns[state][action];
                this.qTable[state][action] = returns.reduce((a, b) => a + b, 0) / returns.length;
            }
        }
    }

    getQValue(state, action) {
        if (!this.qTable[state]) return 0;
        return this.qTable[state][action];
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

    reset() {
        this.epsilon = 1.0;
        this.episodeStates = [];
        this.episodeActions = [];
        this.episodeRewards = [];
        this.initQTable();
    }
}

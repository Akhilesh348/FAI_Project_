// Working Deep Q-Network (DQN) Agent Implementation (Tabular)

class DQNAgent {
    constructor(stateSpace, actionSpace, options = {}) {
        this.stateSpace = stateSpace;
        this.actionSpace = actionSpace;

        // Hyperparameters
        this.alpha = options.alpha || 0.1;        // Learning rate
        this.gamma = options.gamma || 0.99;       // Discount factor
        this.epsilon = options.epsilon || 1.0;    // Exploration rate
        this.epsilonDecay = options.epsilonDecay || 0.995;
        this.epsilonMin = options.epsilonMin || 0.05;

        // Experience replay
        this.memory = [];
        this.memorySize = options.memorySize || 2000;
        this.batchSize = options.batchSize || 32;

        // Networks
        this.network = {};
        this.targetNetwork = {};
        this.updateTargetFrequency = options.updateTargetFrequency || 20;
        this.trainingSteps = 0;

        this.initNetwork();
    }

    initNetwork() {
        // Initialize small random Q-values
        for (let s = 0; s < this.stateSpace; s++) {
            this.network[s] = Array.from({ length: this.actionSpace },
                () => (Math.random() - 0.5) * 0.1);
            this.targetNetwork[s] = [...this.network[s]];
        }
    }

    selectAction(state, training = true) {
        // Epsilon-greedy policy
        if (training && Math.random() < this.epsilon) {
            return Math.floor(Math.random() * this.actionSpace);
        }
        const qValues = this.network[state];
        return qValues.indexOf(Math.max(...qValues));
    }

    storeExperience(state, action, reward, nextState, done) {
        this.memory.push({ state, action, reward, nextState, done });
        if (this.memory.length > this.memorySize) this.memory.shift();
    }

    update(state, action, reward, nextState, done) {
        // Store experience
        this.storeExperience(state, action, reward, nextState, done);

        // Train if enough samples
        if (this.memory.length >= this.batchSize) {
            this.trainOnBatch();
        }

        // Always decay epsilon (so it explores less over time)
        this.epsilon = Math.max(this.epsilonMin, this.epsilon * this.epsilonDecay);

        // Update target network periodically
        this.trainingSteps++;
        if (this.trainingSteps % this.updateTargetFrequency === 0) {
            this.updateTargetNetwork();
        }
    }

    trainOnBatch() {
    const batch = [];
    for (let i = 0; i < this.batchSize; i++) {
        batch.push(this.memory[Math.floor(Math.random() * this.memory.length)]);
    }

    for (const { state, action, reward, nextState, done } of batch) {
        if (!(state in this.network)) this.network[state] = new Array(this.actionSpace).fill(0);
        if (!(nextState in this.targetNetwork)) this.targetNetwork[nextState] = new Array(this.actionSpace).fill(0);

        const currentQ = this.network[state][action];
        const maxNextQ = done ? 0 : Math.max(...this.targetNetwork[nextState]);
        const target = reward + this.gamma * maxNextQ;
        this.network[state][action] += this.alpha * (target - currentQ);
    }
}


    updateTargetNetwork() {
        for (let s = 0; s < this.stateSpace; s++) {
            this.targetNetwork[s] = [...this.network[s]];
        }
    }

    getBestAction(state) {
        const qValues = this.network[state] || new Array(this.actionSpace).fill(0);
        return qValues.indexOf(Math.max(...qValues));
    }

    getQValue(state, action) {
        return this.network[state][action];
    }

    reset() {
        this.epsilon = 1.0;
        this.memory = [];
        this.trainingSteps = 0;
        this.initNetwork();
    }
}

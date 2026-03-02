/**
 * Value Object représentant un coût monétaire
 * Immutable
 */
// // (function () {
export class Cost {
    constructor(amount, currency = 'XOF') {
        if (amount === undefined || amount === null) {
            throw new Error('Cost amount is required');
        }
        if (isNaN(amount)) {
            throw new Error('Cost amount must be a number');
        }
        this._amount = Number(amount);
        this._currency = currency;
        Object.freeze(this);
    }

    get amount() {
        return this._amount;
    }

    get currency() {
        return this._currency;
    }

    add(other) {
        if (other.currency !== this.currency) {
            throw new Error(`Cannot add costs with different currencies: ${this.currency} and ${other.currency}`);
        }
        return new Cost(this.amount + other.amount, this.currency);
    }

    multiply(factor) {
        return new Cost(this.amount * factor, this.currency);
    }

    toString() {
        return `${this.amount.toLocaleString()} ${this.currency}`;
    }

    toJSON() {
        return {
            amount: this.amount,
            currency: this.currency
        };
    }

    static fromJSON(data) {
        if (typeof data === 'number') {
            return new Cost(data);
        }
        if (!data) return null;
        return new Cost(data.amount, data.currency);
    }

    static zero(currency = 'XOF') {
        return new Cost(0, currency);
    }

    static sum(costs) {
        if (!Array.isArray(costs) || costs.length === 0) {
            return Cost.zero();
        }

        const currency = costs[0].currency;
        const total = costs.reduce((sum, cost) => {
            if (cost.currency !== currency) {
                throw new Error('All costs must have the same currency');
            }
            return sum + cost.amount;
        }, 0);

        return new Cost(total, currency);
    }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
    window.Cost = Cost;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Cost;
}
// // })();

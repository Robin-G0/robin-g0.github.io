import {challengeLink, compareChallenge} from './challenges.js?v=phosphor-31';

/** Shared results UI for every engine/theme. Games only publish their score. */
export class ArcadeResults {
    constructor(dialog, description, scores, target, {signal, onScoresChanged = () => {}}) {
        Object.assign(this,{description,scores,target,onScoresChanged});
        this.$ = selector => dialog.querySelector(selector);
        this.closed = false;
        this.$('#arcade-challenge-link').hidden = true;
        this.$('#arcade-share-status').textContent = '';
        this.$('#arcade-challenge-result').textContent = '';
        const greeting = this.$('#arcade-friend-target');
        greeting.hidden = !target;
        greeting.textContent = target ? `${target.name} · ${target.score} to beat` : '';
        this.$('#arcade-score-form').addEventListener('submit', event => {
            event.preventDefault();
            if (scores.rename(description,this.savedRunId,this.$('#arcade-name').value)) {
                this.render();onScoresChanged();
                this.$('#arcade-score-note').textContent = scores.saved ? 'Saved in this browser' : 'Session only';
                this.$('#arcade-challenge-link').hidden = true;
                this.$('#arcade-share-status').textContent = '';
            }
        },{signal});
        this.$('#arcade-name').addEventListener('input', () => {
            const input = this.$('#arcade-name');
            input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);
            this.$('#arcade-save-score').disabled = input.value.length !== 5;
        },{signal});
        this.$('#arcade-challenge-friend').addEventListener('click',()=>this.share(),{signal});
    }
    finish(score) {
        const previous = this.scores.list(this.description)[0]?.score ?? -1;
        this.savedRunId = this.scores.record(this.description,score);
        this.$('#arcade-score-form').hidden = !this.savedRunId;
        this.$('#arcade-name').value = this.scores.data.name;
        this.$('#arcade-save-score').disabled = false;
        this.$('#arcade-score-note').textContent = score > previous ? 'NEW HIGH SCORE' : this.savedRunId ? 'Saved locally' : 'TOP FIVE';
        this.$('#arcade-challenge-result').textContent = this.target ? compareChallenge(score,this.target) : '';
        this.$('#arcade-challenge-link').hidden = true;
        this.$('#arcade-share-status').textContent = '';
        this.render();
    }
    render() {
        this.$('#arcade-scoreboard').replaceChildren(...this.scores.list(this.description).map((record,index)=>{
            const item = document.createElement('li');item.dataset.current = String(record.id === this.savedRunId);
            for (const [tag,text] of [['span',String(index+1).padStart(2,'0')],['b',record.name],['strong',String(record.score)]]) {
                const element = document.createElement(tag);element.textContent = text;item.append(element);
            }
            return item;
        }));
        this.$('#arcade-challenge-friend').disabled = !this.scores.hasScore(this.description);
    }
    async share() {
        const record = this.scores.list(this.description)[0];
        if (!record) return;
        const link = challengeLink(location.href,this.description,record);
        const field = this.$('#arcade-challenge-link');field.value = link;field.hidden = false;
        try {
            await navigator.clipboard.writeText(link);
            if (!this.closed) this.$('#arcade-share-status').textContent = 'Challenge link copied';
        } catch {
            if (!this.closed) {
                this.$('#arcade-share-status').textContent = 'Copy this challenge link';
                field.focus({preventScroll:true});field.select();
            }
        }
    }
    dispose() { this.closed = true; }
}

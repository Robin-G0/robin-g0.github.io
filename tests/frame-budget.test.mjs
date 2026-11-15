import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameBudget } from '../arcade/core/frame-budget.js';

test('high-refresh rendering stays near 60 paints per second without catch-up after stalls',()=>{
    for(const hz of [60,120,144,240]){
        const budget=new FrameBudget(), paints=[];
        for(let i=0;i<=hz;i++){const time=i*1000/hz;if(budget.due(time))paints.push(time);}
        assert.ok(paints.length>=59&&paints.length<=61, hz+' Hz should not multiply render work');
        assert.equal(budget.due(5000),true);assert.equal(budget.due(5001),false);
    }
});

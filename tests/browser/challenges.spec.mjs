import {test,expect} from '@playwright/test';
import {challengeLink} from '../../arcade/core/challenges.js';
import {games} from '../../arcade/catalog.js';
import {SCORE_KEY} from '../../arcade/core/scores.js';

test.use({storageState:{cookies:[],origins:[]}});
async function setup(page) {
    await page.clock.install();
    await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
    await page.route('**/vendor/motion-input-grid/src/index.mjs',r=>r.abort());
}
async function ready(page) {
    if (await page.locator('#arcade-walkthrough').isVisible())
        for (let i=0;i<3;i++)await page.locator('[data-guide-next]').click();
}
const game=games.find(game=>game.engine==='juggle');

test('results share the best score and name; friend receives a separate target, compares and retries',async({page,browser})=>{
    await setup(page);
    await page.addInitScript(({key})=>localStorage.setItem(key,JSON.stringify({version:1,name:'ALICE',games:{
        'juggle:gentle':[{id:'saved',name:'ALICE',score:125,at:1}]
    }})),{key:SCORE_KEY});
    // Force a denied clipboard to exercise the selectable link fallback.
    await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('denied');}}}));
    await page.goto('/?theme=construction#arcade');
    await page.locator('[data-game=construction-juggle]').click();
    await page.locator('#arcade-no-camera').click();await page.clock.runFor(16000);
    await expect(page.locator('#arcade-result')).toBeVisible();
    await page.locator('#arcade-challenge-friend').click();
    await expect(page.locator('#arcade-share-status')).toHaveText('Copy this challenge link');
    const link=await page.locator('#arcade-challenge-link').inputValue();
    const context=await browser.newContext({storageState:{cookies:[],origins:[]}});
    try {
        const friend=await context.newPage();await setup(friend);await friend.goto(link);
        await expect(friend.locator('#arcade-challenge-summary')).toContainText('ALICE challenges you: 125 in GIF Juggler');
        await expect(friend.locator('#arcade-player')).not.toBeVisible();
        await friend.locator('#arcade-play-challenge').click();await ready(friend);
        await expect(friend.locator('#arcade-friend-target')).toHaveText('ALICE · 125 to beat');
        await expect(friend.locator('#arcade-best')).toHaveText('00000');
        await friend.locator('#arcade-no-camera').click();await friend.clock.runFor(16000);
        await expect(friend.locator('#arcade-challenge-result')).toHaveText('ALICE leads by 125');
        await expect(friend.locator('#arcade-scoreboard b')).toHaveText('GUEST');
        await friend.locator('#arcade-again').click();
        await expect(friend.locator('#arcade-friend-target')).toBeVisible();
        await friend.locator('#arcade-close').click();await friend.reload();
        await expect(friend.locator('#arcade-challenge-invite')).toBeVisible();
        await friend.locator('#arcade-dismiss-challenge').click();await friend.reload();
        await expect(friend.locator('#arcade-challenge-invite')).not.toBeVisible();
    } finally {await context.close();}
});

test('friend links choose the right theme and game, retain difficulty, and fit mobile results',async({page})=>{
    await setup(page);await page.setViewportSize({width:320,height:640});
    const link=challengeLink('http://127.0.0.1:8765/',{...game,difficulty:'standard'},{name:'BOBBY',score:0});
    await page.goto(link);await page.locator('#arcade-play-challenge').click();await ready(page);
    await page.locator('#arcade-no-camera').click();await page.clock.runFor(16000);
    await expect(page.locator('#arcade-challenge-result')).toHaveText('Matched BOBBY: 0');
    await page.locator('#arcade-challenge-friend').scrollIntoViewIfNeeded();
    const bounds=await page.locator('#arcade-challenge-friend').boundingBox();expect(bounds.height).toBeGreaterThanOrEqual(44);
    const replay=await page.locator('#arcade-again').boundingBox(),panel=await page.locator('#arcade-result').boundingBox();
    expect(replay.y+replay.height).toBeLessThanOrEqual(panel.y+panel.height+1);
    expect(await page.locator('#arcade-result').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
    await page.screenshot({path:'../arcade-review/challenge-mobile.png'});
    await page.locator('#arcade-challenge-friend').click();
    const shared=await page.locator('#arcade-challenge-link').inputValue();expect(decodeURIComponent(shared)).toContain('standard');
    await page.locator('#arcade-close').click();
    const other=games.find(game=>game.theme==='phosphor');
    await page.goto(challengeLink('http://127.0.0.1:8765/',other,{name:'ALICE',score:12}));
    await expect(page.locator('html')).toHaveAttribute('data-theme','phosphor');
    await page.locator('#arcade-play-challenge').click();
    await expect(page.locator('#arcade-game-title')).toHaveText(other.title);
});

test('malformed targets do not create games, alter a local board, or execute markup',async({page})=>{
    await setup(page);
    await page.goto('/#arcade?challenge='+encodeURIComponent(JSON.stringify({v:1,game:game.id,name:'<img>',score:1,difficulty:'gentle'})));
    await expect(page.locator('#arcade-challenge-invite')).not.toBeVisible();
    await page.locator('[data-game=construction-juggle]').click();
    await expect(page.locator('#arcade-friend-target')).not.toBeVisible();
    await expect(page.locator('#arcade-best')).toHaveText('00000');
});

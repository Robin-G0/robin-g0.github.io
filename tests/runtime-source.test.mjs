import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('the packaged runtime matches its pinned upstream source and retains provenance',async()=>{
    const pin=JSON.parse(await readFile(new URL('../arcade/mig/runtime-source.json',import.meta.url)));
    const metadata=JSON.parse(await readFile(new URL('../vendor/motion-input-grid/package.json',import.meta.url)));
    assert.equal(metadata.runtimeSource.commit,pin.commit);
    for(const[name,hash]of Object.entries(pin.files)){
        const bytes=await readFile(new URL('../vendor/motion-input-grid/runtime/'+name,import.meta.url));
        assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,name+' must remain exact upstream code');
    }
});

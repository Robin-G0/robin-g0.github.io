import { integer } from '../core/random.js?v=eras-3';

// Original, local vocabulary: no password dump or external download is needed.
// Readable combinations keep the game varied without turning names into serial numbers.
const adjectives = (
    'amber antique autumn blue bold bright broken bronze calm chrome classic cloudy ' +
    'cosmic cozy crimson crystal curious daily dancing digital dusty electric emerald ' +
    'faded flying frozen golden hidden indie lazy little lost lucky lunar midnight ' +
    'mint misty neon noisy orange pixel purple quiet rainy retro secret silver sleepy ' +
    'small snowy solar summer sunset tiny velvet vintage violet wandering wild winter'
).split(' ');

const subjects = {
    text: ('adventure agenda almanac archive bookmark checklist diary draft dream essay ' +
        'fable forecast grocery guide handbook journal letter logbook memoir menu message ' +
        'minutes notebook outline plan poem postcard recipe reminder report review riddle ' +
        'roadmap schedule scrapbook shopping story summary transcript wishlist').split(' '),
    image: ('alley arcade balloon beach bicycle bridge cabin cactus castle comet ' +
        'cottage desert dolphin dragon fern firefly forest fox garden harbor ' +
        'island kitten lake lantern lighthouse meadow mountain mushroom ocean otter ' +
        'panda planet rainbow river robot skyline snowflake spaceship waterfall windmill').split(' '),
    code: ('adapter allocator array bridge buffer cache callback client compiler config ' +
        'console controller cursor database decoder deploy dispatcher editor encoder engine ' +
        'factory filter fixture gateway handler index input kernel loader logger ' +
        'matrix module parser pipeline query renderer router scheduler shader worker').split(' '),
    audio: ('anthem ballad bass beat bell birdsong cassette chime chorus concert ' +
        'drum echo fanfare fieldrecording flute guitar harmony heartbeat hymn jam ' +
        'jingle lullaby melody metronome mixtape modem overture piano podcast radio ' +
        'rainfall ringtone serenade sonata soundcheck synth thunder vinyl voicemail whistle').split(' '),
    video: ('animation blooper broadcast cartoon chase clip credits cutscene demo documentary ' +
        'episode expedition festival footage interview intro journey launch montage moonwalk ' +
        'outtake panorama parade performance premiere replay rescue review scene sequence ' +
        'shortfilm skateboarding slalom speedrun timelapse tour trailer tutorial unboxing walkthrough').split(' ')
};

export const generatedNameCount = adjectives.length * Object.values(subjects).reduce((n, words) => n + words.length, 0);
export const NAME_HISTORY_SIZE = 256;

function shuffled(values, random) {
    for (let i = values.length - 1; i > 0; i--) {
        const j = integer(random, 0, i);
        [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
}

/** Session-owned bags survive format unlocks; even another extension cannot repeat a recent stem. */
export function createFilenameGenerator(random) {
    const bags = new Map(), recent = new Set(), history = [];

    function nextName(extension, type) {
        let bag = bags.get(extension);
        if (!bag?.length) {
            const combinations = subjects[type.icon].flatMap(subject => adjectives.map(adjective => `${adjective}_${subject}`));
            // References get exactly one entry, just like every generated name.
            bag = shuffled([...new Set([...combinations, ...type.names])], random);
            bags.set(extension, bag);
        }
        return bag.pop();
    }

    return (extension, type) => {
        let name = nextName(extension, type);
        while (recent.has(name)) name = nextName(extension, type);
        recent.add(name); history.push(name);
        if (history.length > NAME_HISTORY_SIZE) recent.delete(history.shift());
        return `${name}.${extension}`;
    };
}

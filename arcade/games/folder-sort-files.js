import { integer } from '../core/random.js';
import { createFilenameGenerator } from './folder-sort-names.js?v=desktop95-6';

// Every filename is fictional. Classification follows the extension, not the joke.
export const FILE_TYPES = {
    txt: { category: 'text', icon: 'text', names: ['passwords', 'rockyou', 'caramel', 'hello_world'] },
    png: { category: 'media', icon: 'image', names: ['bliss', 'cat_on_keyboard', 'paint_masterpiece'] },
    jpg: { category: 'media', icon: 'image', names: ['vacation_1995', 'bigfoot_blurry'] },
    gif: { category: 'media', icon: 'image', names: ['dancing_baby', 'under_construction'] },
    bmp: { category: 'media', icon: 'image', names: ['untitled_paint', 'desktop_wallpaper'] },
    md: { category: 'text', icon: 'code', names: ['SKILL', 'README', 'dont_panic'] },
    rtf: { category: 'text', icon: 'text', names: ['dear_internet', 'clippy_resume'] },
    js: { category: 'text', icon: 'code', names: ['undefined_is_not_a_function', 'caramel'] },
    py: { category: 'text', icon: 'code', names: ['hello_world', 'not_a_snake'] },
    wav: { category: 'media', icon: 'audio', names: ['dial_up', 'you_have_mail'] },
    mp3: { category: 'media', icon: 'audio', names: ['never_gonna_give_you_up', 'modem_remix'] },
    json: { category: 'text', icon: 'code', names: ['config_final_FINAL', 'package'] },
    css: { category: 'text', icon: 'code', names: ['center_this_div', 'hotdog_stand'] },
    mp4: { category: 'media', icon: 'video', names: ['keyboard_cat', 'rickroll_4k'] },
    webm: { category: 'media', icon: 'video', names: ['dramatic_chipmunk', 'caramel_loop'] },
    cpp: { category: 'text', icon: 'code', names: ['segfault', 'motion_input_grid'] },
    rs: { category: 'text', icon: 'code', names: ['borrow_checker_says_no', 'fearless_crab'] },
    flac: { category: 'media', icon: 'audio', names: ['lossless_dialup', 'silence_deluxe'] },
    mkv: { category: 'media', icon: 'video', names: ['big_buck_bunny', 'movie_final_v9'] },
    sh: { category: 'text', icon: 'code', names: ['it_works_on_my_machine', 'deploy_on_friday'] },
    sql: { category: 'text', icon: 'code', names: ['little_bobby_tables', 'SELECT_caramel'] },
    opus: { category: 'media', icon: 'audio', names: ['space_oddity', 'hold_music'] },
    avif: { category: 'media', icon: 'image', names: ['tiny_cat_big_quality', 'desktop_2095'] }
};

const stages = [
    { after: 0, types: ['txt', 'png'] },
    { after: 5, types: ['jpg', 'gif', 'bmp', 'md', 'rtf'] },
    { after: 15, types: ['js', 'py', 'wav', 'mp3'] },
    { after: 25, types: ['json', 'css', 'mp4', 'webm'] },
    { after: 35, types: ['cpp', 'rs', 'flac', 'mkv'] },
    { after: 45, types: ['sh', 'sql', 'opus', 'avif'] }
];
export const fileStage = sorted => stages.findLastIndex(stage => sorted >= stage.after);
export const fileType = file => FILE_TYPES[file.split('.').at(-1)];
export const fileSide = file => fileType(file).category === 'media' ? 'left' : 'right';

function shuffle(values, random) {
    for (let i = values.length - 1; i > 0; i--) {
        const j = integer(random, 0, i); [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
}

/** Balanced categories and independent extension bags prevent long one-sided runs. */
export function createFileDeck(random) {
    let level = -1, categories = [], bags = {};
    const filename = createFilenameGenerator(random);
    return sorted => {
        const next = fileStage(sorted);
        if (next !== level) { level = next; categories = []; bags = {}; }
        if (!categories.length) categories = shuffle(['media', 'text'], random);
        const category = categories.pop();
        if (!bags[category]?.length) {
            const types = stages.slice(0, level + 1).flatMap(stage => stage.types);
            bags[category] = shuffle(types.filter(type => FILE_TYPES[type].category === category), random);
        }
        const extension = bags[category].pop();
        return filename(extension, FILE_TYPES[extension]);
    };
}

const ranks = [
    [0, 'User'], [5, 'Power user'], [10, 'IT technician'],
    [15, 'Developer'], [25, 'Software engineer'], [40, 'Hacker']
];
export function knowledge(streak) {
    const index = ranks.findLastIndex(([threshold]) => streak >= threshold);
    const [floor, title] = ranks[index], ceiling = ranks[index + 1]?.[0];
    return { title, multiplier: Math.min(8, 1 + Math.floor(streak / 5)),
        progress: ceiling ? (streak - floor) / (ceiling - floor) : 1 };
}

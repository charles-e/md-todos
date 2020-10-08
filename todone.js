
/* this is a test!!!! */

// a tool to  make todos in my obsidian journal
//
//

const { Command } = require("commander");
const toml = require("toml");
const moment = require("moment");
const fs = require("fs");
const path = require("path");
const { findAll, findTags } = require("./todosearch");
const { basename } = require("path");
const GENDIR = "_Generated";
var stdin = process.stdin;

const Operations = {
    bail: 'bail',
    remove: 'remove',
    complete: 'complete'
};

var baseLoc = `${process.env.HOME}/DropBox/Journal`;
const datefmt = "YYYY-MM-DD";

var when = moment(Date.now()); // when is a moment object
console.log(when);

const prog = new Command();

prog.version('0.0.1');
prog.option('-g, --debug', 'output extra debugging')
    .option('-D, --dir <directory>', 'search in directory')
    .option('-W --watch')
    .option('-f --from', "specify which file contains the task", ".*")
    .option('-c --complete [match]', "mark task complete matching task pattern")
    .option('-b --bail [match]', "bail out of task matching task pattern")
    .option('-r --remove [match]', "remove task matching task pattern")
    .option('-a --add <task>', "task to add");

prog.parse(process.argv);
if (prog.dir) {
    console.log('-Dir ' + prog.dir);
    baseLoc = prog.dir;
}

baseLoc = path.normalize(baseLoc);

console.log(baseLoc);

const configLoc = `${process.env.HOME}/.config/obsidian-todo/config.toml`;
const config = toml.parse(fs.readFileSync(configLoc, 'utf-8'));
if (config.baseDir) {
    baseLoc = config.baseDir;
    if (!baseLoc.startsWith("/")) {
        baseLoc = path.join(process.env.HOME, baseLoc);
    }
}

genDir = config.genDir ?? GENDIR;
const genLoc = path.join(baseLoc, genDir);
const dotLoc = path.join(baseLoc, '.obsidian');
const message = config.message;

if (message) {
    console.log(`This is the message: ${message}`);
}

// if nothing is set then assume we are completing something
if (!(prog.complete || prog.watch || prog.bail || prog.remove || prog.add)) {
    prog.complete = true;
}

/*
* Select the current operation and return a state.  Bail out if more than one option on command line.
*/
const toOp = (parsed) => {
    const Operations = {
        bail: 'bail',
        remove: 'remove',
        complete: 'complete',
        add: 'add',
        watch: 'watch'
    };

    var ret;
    for (const key in Operations) {
        if (parsed[key]) {
            if (!ret) {
                ret = Operations[key];
            }
            else {

                console.log("'complete', 'bail', 'watch', 'add', 'remove' are mutually exclusive options - pick one and try again.");
                process.exit(-1);
            }
        }
    }
    return ret;
};

const operation = toOp(prog);

const getReadHandler = (holder, dirLoc, fname) => {
    var ret = holder;
    return (err, data) => {
        if (err) { throw err; }
        const todos = findAll(data, dirLoc);

        const dated = moment(fname, datefmt);
        var byDate;
        if (dated.isValid() && dated.year() > 2000) {
            byDate = ret.dated[fname] = [];
        }
        todos.map((task, n) => {
            if (task.done) {
                ret.done.push(task);
            }
            else {
                ret.pending.push(task);
            }
            if (byDate) {
                byDate.push(task);
            }
            const tags = findTags(task.item);
            tags.map(t => {
                if (!ret.tagged[t]) {
                    ret.tagged[t] = [];
                }
                ret.tagged[t].push(task);
            });

        });
    };
};

const readPath = async (ret, dirLoc) => {

    let dirInfo;
    try {
        const dirPath = path.join(baseLoc, dirLoc);
        dirInfo = await fs.promises.opendir(dirPath);
    } catch (err) {
        console.log(err);
    }
    if (dirInfo === undefined) {
        console.log('undefined');
    }
    for await (const dirent of dirInfo) {
        if (dirent.isFile() && dirent.name.endsWith(".md")) {
            const fPath = path.join(baseLoc, dirLoc, dirent.name);
            const fname = dirent.name.slice(0, -3);
            const readHandler = getReadHandler(ret, path.join(dirLoc, fname),fname);

            fs.readFile(fPath, "utf8", readHandler);
        } else if (dirent.isDirectory() && dirent.name !== genDir) {
            // don't bother with the generated directory
            // otherwise recurse to subdirs
            const dir = path.join(dirLoc, dirent.name);
            readPath(ret, dir);
        }
    }
};

const generate = async () => {
    var todos = { "dated": {}, "done": [], "pending": [], "tagged": {} };

    await readPath(todos, ".");

    //console.log(JSON.stringify(todos, [], 3));
    return todos;
};

const work = async () => {
    const todos = await generate();

    for (const cat in todos) {

        var output = '';
        const todosGrp = todos[cat];
        if (todosGrp instanceof Array) {
            for (var i in todosGrp) {
                const todoItem = todosGrp[i];
                const isDone = todoItem.done ? 'x' : ' ';
                output += `- [${isDone}] ${todoItem.item} [[${todoItem.source}]]\n`;
            }
        } else { // objects with keys
            for (var nTitle in todosGrp) {
                const list = todosGrp[nTitle].filter(i => (i.done === false));
                if (list.length > 0) {
                    output += `# +${nTitle}\n`;
                    for (var x in list) {
                        const todoItem = list[x];
                        const isDone = todoItem.done ? 'x' : ' ';
                        output += `- [${isDone}] ${todoItem.item} [[${todoItem.source}]]\n`;
                    }
                }
            }

        }
        const outPath = path.join(baseLoc, genDir, cat.toUpperCase()) + ".md";
        //        console.log(`writing to ${outPath}`);
        fs.writeFileSync(outPath, output, "UTF-8");
    }
    return todos;
};

const ignoreDirs = [genLoc, dotLoc];
const watchedPath = (fpath) => {
    var ok1 = true;
    ignoreDirs.map(dir => { if (fpath.startsWith(dir)) { ok1 = false; } });
    //:let ok1 = (!fpath.startsWith(genLoc));
    let ok2 = fpath.endsWith(".md");
    return ok1 && ok2;
};
const toFuzzy = patt => {
    var fuzzy = '.*';
    for (var i = 0; i < patt.length; i++) {
        fuzzy += `${patt.charAt(i)}.*`;
    }
    console.log(`fuzzy: ${fuzzy}`);
    return new RegExp(fuzzy, "gm");
};

const pickOne = async (pending, rawPattern) => {
    const pattern = toFuzzy(rawPattern);
    const patternMatcher = filterMatcher(pattern);
    const matching = pending.filter(patternMatcher);
    while (matching.length > 1) {
        for (var m in matching) {
            console.log(matching[m].item);
        }
        break;
    }
    if (matching.length == 1) {
        return matching[0];
    }
    return waitOnStdin(pending, rawPattern);
};

const filterMatcher = (matcher) => {
    return async (data) => {
        var ret = data.item.match(matcher);
        if (ret && data.item === ret[0]) {
            console.log(`${data.item}`);
            return true;
        }
        else return false;
    };
};

const waitOnStdin = async (pending, rawPattern) => {
    var currPatt = rawPattern;
    stdin.setRawMode(true);

    // resume stdin in the parent process (node app won't quit all by itself
    // unless an error or process.exit() happens)
    stdin.resume();

    // i don't want binary, do you?
    //stdin.setEncoding( 'utf8' );

    for await (const key of stdin) {
        if (key[0] === 3) {
            process.exit();
        }
        else if (key[0] === 8) {
            currPatt = currPatt.slice(0, currPatt.length - 2);
        } else {
            currPatt += String.fromCharCode(key[0]);
        }
        const fuzzy = toFuzzy(currPatt);
        const fuzzyFilter = filterMatcher(fuzzy);
        const matching = pending.filter(fuzzyFilter);
        if (matching.length == 1) {
            return (matching[0]);
        }
    }
}

const main = async () => {
    console.log(`run against: ${baseLoc}`);
    const todos = await work();
    if (prog.watch) {
        const chokidar = require('chokidar');

        console.log(`watching...`);
        // One-liner for current directory
        chokidar.watch(baseLoc, { "ignoreInitial": true })
            .on('add', fpath => {
                if (watchedPath(fpath)) {
                    const dateStr = moment().format('YYYY-MM-DD @ HH:mm:ss');
                    console.log(`added ${fpath} at ${dateStr}`);
                    work();
                }
            }).on('change', fpath => {
                const dateStr = moment().format('YYYY-MM-DD @ HH:mm:ss');
                if (watchedPath(fpath)) {

                    console.log(`changed ${fpath} at ${dateStr}`);
                    work();
                }
            }).on('unlink', path => {
                const dateStr = moment().format('YYYY-MM-DD @ HH:mm:ss');
                if (watchedPath(fpath)) {
                    console.log(`deleted ${fpath} at ${dateStr}`);
                    work();
                }
            });
    }
    else if (prog.done || prog.bail || prog.remove) {
        const rawPattern = typeof prog[operation] == "string" ? prog[operation] : '';
        const chosen = await pickOne(todos.pending, rawPattern);
        console.log(`do ${operation} using ${chosen.item}`);
    }
};
main();


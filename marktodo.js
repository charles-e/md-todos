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

var baseLoc = `${process.env.HOME}/DropBox/Journal`;
const datefmt = "YYYY-MM-DD";

var when = moment(Date.now()); // when is a moment object
console.log(when);

const prog = new Command();

prog.version('0.0.1');
prog.option('-d, --debug', 'output extra debugging')
    .option('-D, --dir <directory>', 'search in directory')
    .option('-W --watch');

prog.parse(process.argv);
if (prog.dir) {
    console.log('-Dir ' + prog.dir);
    baseLoc = prog.dir;
}

baseLoc = path.normalize(baseLoc);

console.log(baseLoc);
const configDir = `${process.env.HOME}/.config/obsidian-todo`;
const configLoc = `${configDir}/config.toml`;
const cacheLoc = `${configDir}/cache.json`;
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

const readPath = async (ret, dirLoc, fileCache) => {

    let dirInfo;
    try {
        const dirPath = path.join(baseLoc, dirLoc);
        dirInfo = await fs.promises.opendir(dirPath);
    } catch (err) {
        console.log(err);
    }
    if (dirInfo === undefined) {
        console.log("undefined");
    }
    for await (const dirent of dirInfo) {
        const fPathRelative = path.join(dirLoc, dirent.name);
        const fPath = path.join(baseLoc, fPathRelative);
        const fname = dirent.name.slice(0, -3);
        if (dirent.isFile() && dirent.name.endsWith(".md") && watchedPath(fPath)) {
            var stats;
            try {
                const fd = fs.openSync(fPath);
                stats = fs.fstatSync(fd);
                fs.closeSync(fd);
            } catch (e) { }
            var lastTouch;
            if (stats) {
                lastTouch = fileCache[fPathRelative] && fileCache[fPathRelative].touch;
            }
            /* Only bother to read the file if its new (not in cache) or
                if the modify timestamp is newer than cached
            */
            var todos = [];
            if (lastTouch && lastTouch < stats.mTimeMs) {
                todos = fileCache[fPathRelative].todos;
            } else {
                const data = fs.readFileSync(fPath, "utf8");
                todos = findAll(data, path.join(dirLoc, fname));
                if (todos.length > 0) {
                    todos = todos.map((task, n) => {
                        task.touched = stats.mTimeMs;
                        task.changed = true;
                        return task;
                    });
                    fileCache[fPathRelative] = {
                        touch: stats.mTimeMs,
                        todos: todos
                    };
                }
            }
            const dated = moment(fname, datefmt);
            var byDate;
            if (dated.isValid() && dated.year() > 2000) {
                byDate = ret.dated[fname] = [];
            }
            todos.map((task, n) => {
                //task.touched = stats.mTimeMs;
                if (task.done && task.changed) {
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

        } else if (dirent.isDirectory() && dirent.name !== genDir) {
            // don't bother with the generated directory
            // otherwise recurse to subdirs
            const dir = path.join(dirLoc, dirent.name);
            readPath(ret, dir, fileCache);
        }
    }
}

const generate = async () => {
    var todos = { "dated": {}, "done": [], "pending": [], "tagged": {} };
    var fileCache = {};
    try {
        const fileCacheData = fs.readFileSync(cacheLoc, 'utf-8');
        fileCache = JSON.parse(fileCacheData);
    } catch (e) {
        console.log('creating new file cache')
    }

    await readPath(todos, ".", fileCache);

    fs.writeFileSync(cacheLoc, JSON.stringify(fileCache), "UTF-8");

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
                const checkbox = cat === "done" ? '' : ` - [${isDone}]`;
                const itemDate = moment(todoItem.touched);
                const stamp = cat !== "done" ? "" : itemDate.format('YYYY-MM-DD');
                //                output += `- [${isDone}] ${todoItem.item} [[${todoItem.source}]]\n`;
                const itemSrc = isDone ? `[{${todoItem.source}}]` : `[[${todoItem.source}]]`;
                output += `${stamp}${checkbox} ${todoItem.item} ${itemSrc}\n`;
            }
        } else { // objects with keys
            for (var nTitle in todosGrp) {
                const list = todosGrp[nTitle].filter(i => (i.done === false));
                if (list.length > 0) {
                    output += `# +${nTitle}\n`;
                    for (var x in list) {
                        const todoItem = list[x];
                        const isDone = todoItem.done ? 'x' : ' ';
                        const checkbox = cat === "done" ? '' : ` - [${isDone}]`;
                        const itemDate = moment(todoItem.touched);
                        const stamp = cat !== "done" ? "" : itemDate.format('YYYY-MM-DD');
                        const itemSrc = isDone ? `[{${todoItem.source}}]` : `[[${todoItem.source}]]`;
                        output += `${stamp}${checkbox} ${todoItem.item} ${itemSrc}\n`;
                    }
                }
            }

        }
        debugger;
        const outPath = path.join(baseLoc, genDir, cat.toUpperCase()) + ".md";
        //        console.log(`writing to ${outPath}`);
        if (cat === "done") {
            fs.appendFileSync(outPath, output, "UTF-8");
        } else {
            fs.writeFileSync(outPath, output, "UTF-8");
        }
    }
};

var ignoreDirs = [genLoc, dotLoc];
if (config.ignoreDirs) {
    for (const dir in config.ignoreDirs)
        ignoreDirs.push(path.join(baseLoc, config.ignoreDirs[dir]));
}
console.log(`ignoreDirs: ${ignoreDirs}`);

const watchedPath = (fpath) => {
    for (const id in ignoreDirs) {
        if (fpath.startsWith(ignoreDirs[id])) {
            return false;
        }
    }
    return true;
};

const main = async () => {
    console.log(`run against: ${baseLoc}`);
    await work();
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
            })
            .on('change', fpath => {
                const dateStr = moment().format('YYYY-MM-DD @ HH:mm:ss');
                if (watchedPath(fpath)) {
                    console.log(`changed ${fpath} at ${dateStr}`);
                    work();
                }
            })
            .on('unlink', fpath => {
                const dateStr = moment().format('YYYY-MM-DD @ HH:mm:ss');
                if (watchedPath(fpath)) {
                    console.log(`deleted ${fpath} at ${dateStr}`);
                    work();
                }
            });
    }

};
main();

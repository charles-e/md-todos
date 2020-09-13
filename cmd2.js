// a tool to  make todos in my obsidian journal
//
//

const { Command } = require("commander");
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
    .option('-D, --dir <directory>', 'search in directory');

prog.parse(process.argv);
if (prog.dir) {
    console.log('-Dir ' + prog.dir);
    baseLoc = prog.dir;
}

baseLoc = path.normalize(baseLoc);

console.log(baseLoc);

const configLoc = `${process.env.HOME}/.config/obsidian-todo/config.toml`;
const config = toml.parse(fs.readFileSync(configLoc, 'utf-8'));
baseLoc = config.baseDir;
genDir = config.genDir ?? GENDIR;

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
            fs.readFile(fPath, "utf8", (err, data) => {
                if (err) { throw err; };
                const todos = findAll(data, path.join(dirLoc, fname));

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
                /* for (const t in todos) {
                    if (todos[t].done == false) {
                        console.log(todos[t].item);
                    }
                } */
            });

        } else if (dirent.isDirectory() && dirent.name !== genDir) {
            // don't bother with the generated directory
            // otherwise recurse to subdirs
            const dir = path.join(dirLoc, dirent.name);
            readPath(ret, dir);
        }
    }
}

const generate = async () => {
    var todos = { "dated": {}, "done": [], "pending": [], "tagged": {} };

    await readPath(todos, ".");

    console.log(JSON.stringify(todos, [], 3));
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
                    for (var i in list) {
                        const todoItem = list[i];
                        const isDone = todoItem.done ? 'x' : ' ';
                        output += `- [${isDone}] ${todoItem.item} [[${todoItem.source}]]\n`;
                    }
                }
            }

        }
        const outPath = path.join(baseLoc, genDir, cat) + ".md";
        console.log(`writing to ${outPath}`);
        fs.writeFileSync(outPath, output, "UTF-8");
    }
};
work();
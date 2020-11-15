// a tool to  make todos in my obsidian journal
//
//

const {
  Command
} = require("commander");
const toml = require("toml");
const moment = require("moment");
const fs = require("fs");
const path = require("path");
const {
  findAll,
  findTags
} = require("./todosearch");
const {
  basename
} = require("path");
const GENDIR = "_Generated";
const mtd = require("./mtd");

var baseLoc = `${process.env.HOME}/DropBox/Journal`;

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
var configDir = process.env.MARKTODO_CONFIGDIR;
if (!configDir) {
  configDir = `${process.env.HOME}/.config/marktask`;
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir);
  }
}
const configLoc = `${configDir}/config.toml`;
const cacheLoc = `${configDir}/cache.json`;


console.log(`configLoc ${configLoc}`);
const config = fs.existsSync(configLoc) ? toml.parse(fs.readFileSync(configLoc, 'utf-8')) : {};
if (config.baseDir) {
  baseLoc = config.baseDir;
  if (!baseLoc.startsWith("/")) {
    baseLoc = path.join(process.env.HOME, baseLoc);
  }
}
const datefmt = config.dateFmt ?? "YYYY-MM-DD";
genDir = config.genDir ?? GENDIR;
const genLoc = path.join(baseLoc, genDir);
const dotLoc = path.join(baseLoc, '.obsidian');

const taskapi = new mtd({
  "baseLoc": baseLoc,
  "genLoc": genLoc,
});

const readPath = async (dirLoc, fileCache) => {

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
      } catch (e) {}
      var lastTouch;
      var isNew = true;
      if (stats) {
        lastTouch = fileCache[fPathRelative] && fileCache[fPathRelative].touch;
        isNew = false;
      }
      /* Only bother to read the file if its new (not in cache) or
          if the modify timestamp is newer than cached
      */
      var oldTodos = [];
      var isOld = lastTouch && lastTouch < stats.mTimeMs;
      if (isOld) {
        oldTodos = fileCache[fPathRelative].todos;
      } else {
        const text = fs.readFileSync(fPath, "utf8");
        const tasksPath = path.join(dirLoc, fname);
        todos = taskapi.findTasks(text, tasksPath);

        console.log(fname);
        if (todos.length > 0) {
          console.log(`count = ${todos.length}`);
          todos = todos.map((task, n) => {
            task.touched = stats.mTimeMs;
            return task;
          });
          fileCache[fPathRelative] = {
            touch: stats.mTimeMs,
            todos: todos
          };
        }
        taskapi.markTasks(todos, text, tasksPath);
      }
      taskapi.mergeTasks(todos, fname);

    } else if (dirent.isDirectory() && dirent.name !== genDir) {
      // don't bother with the generated directory
      // otherwise recurse to subdirs
      const dir = path.join(dirLoc, dirent.name);
      await readPath(dir, fileCache);
    }
  }
};

const deleteTodosFor = (todos, forPath) => {
  for (const cat in todos) {
    const todosGrp = todos[cat];
    if (todosGrp instanceof Array) {
      todos[cat] = todosGrp.filter((item) => (item.source !== forPath));
    } else { // objects with keys
      for (var nTitle in todosGrp) {
        todos[cat][nTitle] = todos[cat][nTitle].filter((item) => (item.source !== forPath));
      }
    }
  }
};

const outputTodos = () => {
  let todos = taskapi.taskData;
  for (const cat in todos) {

    var output = '';
    const todosGrp = todos[cat];

    if (cat === 'dated' || cat === 'tagged') { // objects with keys
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
    else {
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
    }

    //debugger;
    const outPath = path.join(baseLoc, genDir, cat.toUpperCase()) + ".md";
    //        console.log(`writing to ${outPath}`);
    if (cat === "done") {
      fs.appendFileSync(outPath, output, "UTF-8");
    } else {
      fs.writeFileSync(outPath, output, "UTF-8");
    }
  }
}

const scanAll = async (fileCache) => {
  await readPath(".", fileCache);
  outputTodos();
  fs.writeFileSync(cacheLoc, JSON.stringify(fileCache), "UTF-8");
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
  var fileCache = {};
  try {
    const fileCacheData = fs.readFileSync(cacheLoc, 'utf-8');
    fileCache = JSON.parse(fileCacheData);
  } catch (e) {
    console.log('creating new file cache');
  }
  await scanAll(fileCache);
  if (prog.watch) {
    const chokidar = require('chokidar');

    console.log(`watching...`);
    // One-liner for current directory
    chokidar.watch(baseLoc, {
        "ignoreInitial": true
      })
      .on('add', fpath => {
        if (watchedPath(fpath)) {
          const dateStr = moment().format('YYYY-MM-DD @ HH:mm:ss');
          console.log(`added ${fpath} at ${dateStr}`);
          const data = fs.readFileSync(fpath, "utf8");
          const todos = taskapi.findAll(data, fpath);
          taskapi.markTasks(todos, data, fpath);
          taskapi.mergeTasks(todos, fpath);

          outputTodos(taskData);
          fileCache[fPathRelative] = {
            touch: (new Date().getTime()),
            todos: todos
          };
          fs.writeFileSync(cacheLoc, JSON.stringify(fileCache), "UTF-8");
        }
      })
      .on('change', fpath => {
        const dateStr = moment().format('YYYY-MM-DD @ HH:mm:ss');
        if (watchedPath(fpath)) {
          console.log(`changed ${fpath} at ${dateStr}`);
          const data = fs.readFileSync(fpath, "utf8");
          todos = findAll(data, fpath);
          taskapi.markTasks(todos, data, fpath);
          taskapi.mergeTasks(todos, fpath);
          outputTodos(todos);
        }
        fileCache[fPathRelative] = {
          touch: (new Date().getTime()),
          todos: todos
        };
        fs.writeFileSync(cacheLoc, JSON.stringify(fileCache), "UTF-8");
      })
      .on('unlink', fpath => {
        const dateStr = moment().format('YYYY-MM-DD @ HH:mm:ss');
        if (watchedPath(fpath)) {
          console.log(`deleted ${fpath} at ${dateStr}`);
          deleteTodosFor(todos, fpath);
        }
        delete(fileCache[fPathRelative]);
        fs.writeFileSync(cacheLoc, JSON.stringify(fileCache), "UTF-8");
      });
  }

};
main();

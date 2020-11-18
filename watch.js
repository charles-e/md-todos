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

var baseLoc = `${process.env.HOME}/testchokidar`;

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

var ignoreCache = {};
taskapi.writeHandler = async (text, fpath) => {
  try {
    let resolved = path.join(baseLoc, fpath) + ".md";
    console.log(text);
    console.log(`writing to ${resolved}`);
    await fs.promises.writeFile(resolved, text);

  } catch (e) {
    console.log(`error ${e} writing ${resolved}`);

  }
  ignoreCache[fpath] = text;
};

const readPath = async (dirLoc, fileCache) => {

  let dirInfo;
  try {
    const dirPath = path.join(baseLoc, dirLoc);
    dirInfo = await fs.promises.opendir(dirPath);
  } catch (err) {
    console.log(`error opening directory ${ err } `);
    throw (err);
  }
  if (dirInfo === undefined) {
    console.log("undefined");
  }
  for await (const dirent of dirInfo) {
    const fPathRelative = path.join(dirLoc, dirent.name);
    const fPath = path.join(baseLoc, fPathRelative);
    const fname = dirent.name.slice(0, -3);
    if (fname === '2020-11-17') {
      debugger;
    }
    if (dirent.isFile() && dirent.name.endsWith(".md")) {
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
      var isOld = lastTouch && lastTouch >= stats.mtime.getTime();
      if (isOld) {
        todos = fileCache[fPathRelative].todos;
      } else {
        let text;
        try {
          console.log(`reading file ${fPath}`);
          text = fs.readFileSync(fPath, "utf8");
        } catch (err) {
          console.log(`${err} reading file ${fPath}`);
          throw (err);
        }
        const tasksPath = path.join(dirLoc, fname);
        todos = taskapi.findTasks(text, tasksPath);

        //console.log(fname);
        if (todos.length > 0) {
          todos = todos.map((task, n) => {
            task.touched = stats.mtime.getTime();
            return task;
          });
          fileCache[fPathRelative] = {
            "touch": stats.mtime.getTime(),
            "todos": todos
          };
        }
        taskapi.markTasks(todos, text, tasksPath);
      }
      taskapi.mergeTasks(todos, fname);

    } else if (dirent.isDirectory() && dirent.name !== genDir) {
      // don't bother with the generated directory
      // otherwise recurse to subdirs
      const dir = path.join(dirLoc, dirent.name);
      let resolved = path.join(baseLoc, dir);
      console.log(`cd to ${resolved}`);
      if (watchedPath(resolved)) {
        await readPath(dir, fileCache);
      }
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

    } else {
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
      console.log(`ignoring ${fpath}`);
      return false;
    }
  }
  if (fpath.endsWith(".git")) {
    return false;
  } else if (fpath.endsWith(".trash")) {
    return false;
  } else return true;
};

var bounceList = [];

const debounce = (wait) => {
  let timeout;

  return function executedFunction(path) {
    const later = async () => {
      clearTimeout(timeout);
      while (bounceList.length > 0) {
        const path = bounceList.pop()
        await handleMod(path);
      }
    };

    clearTimeout(timeout);
    if (bounceList.indexOf(path) < 0) {
      bounceList.push(path);
    }
    timeout = setTimeout(later, wait);
  };
};


const handleMod = async (fpath) => {
  const dateStr = moment().format('YYYY-MM-DD @ HH:mm:ss');
  if (watchedPath(fpath)) {
    if (ignoreCache[fpath]) {
      console.log(`ignored ${fpath}`)
      delete(ignoreCache[fpath]);
    } else {
      console.log(`changed ${fpath} at ${dateStr}`);
      let text;
      try {
        text = fs.readFileSync(fpath, "utf8");
      } catch (err) {
        console.log(`${err} reading file ${fpath}`);
        throw (err);
      }
      todos = findAll(text, fpath);
      await taskapi.markTasks(todos, text, fpath);
      taskapi.mergeTasks(todos, fpath);
      outputTodos(todos);
      fileCache[fpath] = {
        "touch": Date.now(),
        "todos": todos
      };
      fs.writeFileSync(cacheLoc, JSON.stringify(fileCache), "UTF-8");
    }
  }
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
  //await scanAll(fileCache);
  if (prog.watch) {
    const chokidar = require('chokidar');

    console.log(`watching ${baseLoc}`);
    // One-liner for current directory
    //
    try {
      await chokidar.watch(baseLoc, {
          "ignoreInitial": true
        })
        .on('add', async fpath => {
          console.log(`add ${fpath}`)
          if (watchedPath(fpath)) {
            if (ignoreCache[fpath]) {
              console.log(`ignored ${fpath}`)
              delete(ignoreCache[fpath]);
            } else {
              const dateStr = moment().format('YYYY-MM-DD @ HH:mm:ss');
              console.log(`added ${fpath} at ${dateStr}`);
              let text;
              try {
                text = fs.readFileSync(fpath, "utf8");
              } catch (err) {
                console.log(`${err} reading file ${fpath}`);
                throw (err);
              }
              const todos = taskapi.findAll(text, fpath);
              await taskapi.markTasks(todos, text, fpath);
              taskapi.mergeTasks(todos, fpath);

              outputTodos(taskData);
              fileCache[fpath] = {
                "touch": Date.now(),
                "todos": todos
              };
              fs.writeFileSync(cacheLoc, JSON.stringify(fileCache), "UTF-8");
            }
          }
        })
        .on('change', async fpath => {
          console.log(`debouncing ${fpath}`);
        })
        .on('unlink', async fpath => {
          console.log(`unlink ${fpath}`)
        });
    } catch (err) {
      console.log(`chokidar error ${err}`);
    }
  }

};
main();

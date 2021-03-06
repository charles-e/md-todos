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
  basename
} = require("path");
const GENDIR = "_Generated";
const mtd = require("./mtd");
const ansiEscapes = require("ansi-escapes");
const activeWin = require("active-win");

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
  if (prog.debug) console.log('-Dir ' + prog.dir);
  baseLoc = prog.dir;
}

baseLoc = path.normalize(baseLoc);

if (prog.debug) console.log(baseLoc);
var configDir = process.env.MARKTODO_CONFIGDIR;
if (!configDir) {
  configDir = `${process.env.HOME}/.config/marktask`;
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir);
  }
}
const configLoc = `${configDir}/config.toml`;
const cacheLoc = `${configDir}/cache.json`;
const stateLoc = `${configDir}/state.json`;


if (prog.debug) console.log(`configLoc ${configLoc}`);
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
    if (prog.debug) console.log(text);
    if (prog.debug) console.log(`writing to ${fpath}`);
    await fs.promises.writeFile(fpath, text);

  } catch (e) {
    console.log(`error ${e} writing ${fpath}`);

  }
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
  for await (const dirent of dirInfo) {
    const fPathRelative = path.join(dirLoc, dirent.name);
    const fPath = path.join(baseLoc, fPathRelative);
    const relPath = fPath.substring(baseLoc.length + 1, fPath.length - 3);
    const fname = dirent.name.slice(0, -3);
    if (fname === 'foo') {
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
          if (prog.debug) console.log(`reading file ${fPath}`);
          text = fs.readFileSync(fPath, "utf8");
        } catch (err) {
          console.log(`${err} reading file ${fPath}`);
          throw (err);
        }
        todos = taskapi.findTasks(text, relPath);

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
        todos = await taskapi.markTasks(todos, text, fPath);
      }
      taskapi.mergeTasks(todos, relPath);

    } else if (dirent.isDirectory() && dirent.name !== genDir) {
      // don't bother with the generated directory
      // otherwise recurse to subdirs
      const dir = path.join(dirLoc, dirent.name);
      let resolved = path.join(baseLoc, dir);
      if (prog.debug) console.log(`cd to ${resolved}`);
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

const outputTasks = () => {
  
  let tasks = taskapi.taskData;
  for (const cat in tasks) {

    var output = '';
    const todosGrp = tasks[cat];

    if (cat === 'dated' || cat === 'tagged') { // objects with keys
      for (var nTitle in todosGrp) {
        const list = todosGrp[nTitle].filter(i => (i.done === false));
        if (list.length > 0) {
          output += `# +${nTitle}\n`;
          for (var x in list) {
            const todoItem = list[x];
            const isDone = todoItem.done ? 'x' : ' ';
            const checkbox = cat === "complete" ? '' : ` - [${isDone}]`;
            const itemDate = moment(todoItem.touched);
            const stamp = cat !== "complete" ? "" : itemDate.format('YYYY-MM-DD');
            const itemSrc = isDone ? `[{${todoItem.source}}]` : `[[${todoItem.source}]]`;
            output += `${stamp}${checkbox} ${todoItem.item} ${itemSrc}\n`;
          }
        }
      }
    } else if (cat === 'pending') {
      // Group the tasks by the source note
      const allSrc = []
      const allTask = [];
      Object.values(tasks[cat]).map(task => {
        idx = allSrc.indexOf(task.source);
        if (idx < 0) {
          allSrc.push(task.source);
          allTask.push([task]);
        } else {
          allTask[idx].push(task);
        }
      })
      for (var x; x < allSrc.length; x++) {
        let source = allSrc[x];
        let list = allTask[x];
        let title = path.basename(source);
        output += `## [[${source}#Tasks|${title}]]\n`;
        for (const y in list) {
          const task = list[y];
          const itemDate = moment(task.touched);
          const stamp = cat !== "complete" ? "" : itemDate.format('YYYY-MM-DD ');
          output += `- ${stamp}${task.item}\n`;
        }
      }
    } else if (cat === 'complete'){
      let monthWin = moment().subtract(1,'M');
      let outVals = Object.values(tasks[cat]).filter(task => {
        let mom = moment(new Date(task.doneStamp));
        return mom.isAfter(monthWin);
      }).sort((a,b)=>(b.doneStamp - a.doneStamp));
      for (var i in outVals) {
        const todoItem = outVals[i];
        const itemDate = moment(todoItem.doneStamp);
        const stamp = cat !== "complete" ? "" : itemDate.format('YYYY-MM-DD ');
        let link = todoItem.source ? "[[" + todoItem.source.substring(baseLoc.length + 1, todoItem.source.length - 3) + "]]" : "";
        output += `- ${stamp}${todoItem.item} ${link}\n`;
      }
    } else {
      for (var i in todosGrp) {
        const todoItem = todosGrp[i];
        const itemDate = moment(todoItem.touched);
        const stamp = cat !== "complete" ? "" : itemDate.format('YYYY-MM-DD ');
        let link = todoItem.source ? "[[" + todoItem.source.substring(baseLoc.length + 1, todoItem.source.length - 3) + "]]" : "";
        output += `- ${stamp}${todoItem.item} ${link}\n`;
      }
    }

    //debugger;
    const outPath = path.join(baseLoc, genDir, capitalize(cat)) + ".md";
    //        console.log(`writing to ${outPath}`);
    
    try{
      //if (cat === "complete") {
      //  fs.appendFileSync(outPath, output, "UTF-8");
      //} else {
        fs.writeFileSync(outPath, output, "UTF-8");
        if (prog.debug && cat === "pending") console.log(`wrote ${output.length} chars to ${capitalize(cat)}`)
      //}
    }catch(e){
       console.log(`error ${e} writing to ${capitalize(cat)}`)
    }
  }
}
const capitalize = (s) => {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
};

const scanAll = async (fileCache) => {
  await readPath(".", fileCache);
  outputTasks();
  fs.writeFileSync(cacheLoc, JSON.stringify(fileCache), "UTF-8");
  fs.writeFileSync(stateLoc, JSON.stringify(taskapi.data), "UTF-8");
};

var ignoreDirs = [genLoc, dotLoc];
if (config.ignoreDirs) {
  for (const dir in config.ignoreDirs)
    ignoreDirs.push(path.join(baseLoc, config.ignoreDirs[dir]));
}
if (prog.debug) console.log(`ignoreDirs: ${ignoreDirs}`);


const watchedPath = (fpath) => {
  for (const id in ignoreDirs) {
    if (fpath.startsWith(ignoreDirs[id])) {
      if (prog.debug) console.log(`ignoring ${fpath}`);
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


const handleMod = async (fpath) => {
  const dateStr = moment().format('YYYY-MM-DD @ HH:mm:ss');
  if (prog.debug) console.log(`changed ${fpath} at ${dateStr}`);
  let text;
  try {
    text = fs.readFileSync(fpath, "utf8");
  } catch (err) {
    console.log(`${err} reading file ${fpath}`);
    return;
  }
  const relpath = fpath.substring(baseLoc.length + 1, fpath.length - 3);
  var todos = taskapi.findTasks(text, relpath);
  todos = await taskapi.markTasks(todos, text, fpath);
  taskapi.mergeTasks(todos, relpath);
  outputTasks();
  fileCache[fpath] = {
    "touch": Date.now(),
    "todos": todos
  };
  fs.writeFileSync(cacheLoc, JSON.stringify(fileCache), "UTF-8");
  fs.writeFileSync(stateLoc, JSON.stringify(taskapi.data), "UTF-8");
};

const bgQ = [];
const backgroundTask = async () => {
  let win = await activeWin();
  if (win && win.title && (!win.title.toLowerCase().startsWith('obsidian'))) {
    while (bgQ.length > 0) {
      let path = bgQ.pop();
      await handleMod(path);
    }
  }
  setTimeout(backgroundTask, 60000);
};

var fileCache = {};
var n = 0;
const main = async () => {
  console.log(`run against: ${baseLoc}`);
  try {
    const fileCacheData = fs.readFileSync(cacheLoc, 'utf-8');
    fileCache = JSON.parse(fileCacheData);
  } catch (e) {
    console.log('creating new file cache');
  }
  await scanAll(fileCache);
  taskapi.writeHandler = async (text, fpath) => {
    try {
      if (!prog.debug) {
        process.stdout.write(ansiEscapes.eraseLines(1) + `writing to ${fpath}`);
      } else {
        console.log(`writing to ${fpath}`);
        n++;
      }

      await fs.promises.writeFile(fpath, text);

    } catch (e) {
      console.log(`error ${e} writing ${fpath}`);

    }
    ignoreCache[fpath] = text;
  };
  if (prog.watch) {
    const chokidar = require('chokidar');

    console.log(`watching ${baseLoc}`);
    // One-liner for current directory
    //
    try {
      await backgroundTask();
      await chokidar.watch(baseLoc, {
          "ignoreInitial": true,
          "usePolling": true
        })
        .on('add', async fpath => {
          console.log()
          if (watchedPath(fpath)) {
            if (ignoreCache[fpath]) {
              if (prog.debug) console.log(`ignored ${fpath}`)
              delete(ignoreCache[fpath]);
            } else {
              const dateStr = moment().format('YYYY-MM-DD @ HH:mm:ss');
              if (!prog.debug) process.stdout.write(ansiEscapes.eraseLines(1));
              console.log(`added ${fpath} at ${dateStr}`);

              let text;
              try {
                text = fs.readFileSync(fpath, "utf8");
              } catch (err) {
                console.log(`${err} reading file ${fpath}`);
                throw (err);
              }
              const relpath = fpath.substring(baseLoc.length + 1, fpath.length - 3);
              var todos = taskapi.findTasks(text, relpath);
              todos = await taskapi.markTasks(todos, text, fpath);
              taskapi.mergeTasks(todos, relpath);

              outputTasks();
              fileCache[fpath] = {
                "touch": Date.now(),
                "todos": todos
              };
              fs.writeFileSync(cacheLoc, JSON.stringify(fileCache), "UTF-8");
              fs.writeFileSync(stateLoc, JSON.stringify(taskapi.data), "UTF-8");
            }
          }
        })
        .on('change', async fpath => {
          if (watchedPath(fpath)) {
            if (ignoreCache[fpath]) {
              if (prog.debug) console.log(`ignored ${fpath}`)
              delete(ignoreCache[fpath]);
            } else {
              bgQ.push(fpath);
            }
          }
        })
        .on('unlink', async fpath => {
          const dateStr = moment().format('YYYY-MM-DD @ HH:mm:ss');
          if (watchedPath(fpath)) {
            if (prog.debug) console.log(`deleted ${fpath} at ${dateStr}`);
            await taskapi.deleteTasksFor(todos, fpath);
          }
          delete(fileCache[fpath]);
          fs.writeFileSync(cacheLoc, JSON.stringify(fileCache), "UTF-8");
          fs.writeFileSync(stateLoc, JSON.stringify(taskapi.data), "UTF-8");
        });
    } catch (err) {
      console.log(`chokidar error ${err}`);
    }
  }

};
main();

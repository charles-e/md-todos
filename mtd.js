// a tool to  make todos in my obsidian journal
//
//

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

class mtd {

  constructor(params) {
    this.baseLoc = params.baseLoc;
    this.configDir = params.configDir;
    this.configLoc = `${this.configDir}/config.toml`;
    this.cacheLoc = `${this.configDir}/cache.json`;
    this.when = params.when;
    this.datefmt = params.dateFmt;
    this.genLoc = params.genLoc;
    this.dotLoc = params.dotLoc;
    this.ignoreDirs = params.ignoreDirs;
  }


  async readPath(ret, dirLoc, fileCache) {

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
          const data = fs.readFileSync(fPath, "utf8");
          todos = findAll(data, path.join(dirLoc, fname));
          if (todos.length > 0) {
            todos = todos.map((task, n) => {
              task.touched = stats.mTimeMs;
              return task;
            });
            fileCache[fPathRelative] = {
              touch: stats.mTimeMs,
              todos: todos
            };
          }
        }
        mergeTodos(ret, todos, fname, !isOld);

      } else if (dirent.isDirectory() && dirent.name !== genDir) {
        // don't bother with the generated directory
        // otherwise recurse to subdirs
        const dir = path.join(dirLoc, dirent.name);
        readPath(ret, dir, fileCache);
      }
    }
  }
  mergeTodos(taskData, todos, fname, changed) {
    const dated = moment(fname, datefmt);
    var byDate;
    if (dated.isValid() && dated.year() > 2000) {
      byDate = ret.dated[fname] = [];
    }
    todos.map((task, n) => {
      //task.touched = stats.mTimeMs;
      if (task.done && changed) {
        taskData.done.push(task);
      } else {
        taskData.pending.push(task);
      }
      if (byDate) {
        byDate.push(task);
      }
      const tags = findTags(task.item);
      tags.map(t => {
        if (!taskData.tagged[t]) {
          taskData.tagged[t] = [];
        }
        taskData.tagged[t].push(task);
      });

    });

  }

  async generateAll(todos, fileCache) {

    await this.readPath(todos, ".", fileCache);
    //console.log(JSON.stringify(todos, [], 3));
  }

  deleteTodosFor(todos, forPath) {
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
  }

  outputTodos(todos) {
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

  async scanAll(todos, fileCache) {
    await this.generateAll(todos, fileCache);
    this.outputTodos(todos);
    fs.writeFileSync(cacheLoc, JSON.stringify(fileCache), "UTF-8");
  }


  watchedPath(fpath) {
    for (const id in this.ignoreDirs) {
      if (fpath.startsWith(this.ignoreDirs[id])) {
        return false;
      }
    }
    return true;
  }
}

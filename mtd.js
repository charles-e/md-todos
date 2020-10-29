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

function spliceSlice(str, index, count, add) {
  // We cannot pass negative indexes directly to the 2nd slicing operation.
  if (index < 0) {
    index = str.length + index;
    if (index < 0) {
      index = 0;
    }
  }

  return str.slice(0, index) + (add || "") + str.slice(index + count);
}

class mtd {
  constructor(params) {
    const wrtHandler = async (buf, name) => {};
    this.wrtHandler = (params && params.wrtHandler) ? params.wrtHandler : wrtHandler;
    this.taskData = {
      "dated": {},
      "done": {},
      "pending": {},
      "tagged": {},
    };
    this.numRecents = (params && params.numRecents) ? params.numRecents : 200;
    this.when = (params && params.when) ? params.when : new Date(Date.now());
    this.dateFmt = (params && params.dateFmt) ? params.dateFmt : "YYYY-MM-DD"; // default
    if (params && params.taskData) {
      this.taskData = params.taskData;
    }
    if (params) {
      this.baseLoc = params.baseLoc;
      this.configDir = params.configDir;
      this.configLoc = `${this.configDir}/config.toml`;
      this.cacheLoc = `${this.configDir}/cache.json`;
      this.genLoc = params.genLoc;
      this.dotLoc = params.dotLoc;
      this.ignoreDirs = params.ignoreDirs;
      if (params.taskData) {
        this.taskData = params.taskData;
      }
    };
  }

  set writeHandler(handler) {
    this.wrtHandler = handler;
  }

  get writeHandler() {
    return this.wrtHandler;
  }

  set data(data) {
    this.taskData = data;
  }

  get data() {
    return this.taskData;
  }
  get now() {
    return this.when;
  }

  set now(theTime) {
    this.when = theTime;
  }

  get pendingList() {
    let td = this.taskData;
    return td && td.pending ? Object.values(td.pending) : [];
  }

  get doneList() {
    let td = this.taskData;
    return td && td.done ? Object.values(td.done) : [];
  }

  get pendingMap() {
    let td = this.taskData;
    return (td && td.pending) ? td.pending : new Map();
  }

  get doneMap() {
    let td = this.taskData;
    return (td && td.done) ? td.done : new Map();
  }

  get taggedMap() {
    let td = this.taskData;
    return (td && td.tagged) ? td.tagged : new Map();
  }

  async readPath(dirLoc, fileCache) {

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
        mergeTodos(todos, fname, !isOld);

      } else if (dirent.isDirectory() && dirent.name !== genDir) {
        // don't bother with the generated directory
        // otherwise recurse to subdirs
        const dir = path.join(dirLoc, dirent.name);
        readPath(dir, fileCache);
      }
    }
  }

  async idTodos(todos, text, fname) {
    var newText = text;
    for (const t in todos) {
      const task = todos[t];
      task.tags = findTags(task.item);
      const tids = task.tags.filter(tag => {
        return tag.startsWith('uid');
      })
      const tid = tids[0] ? tids[0] : `uid-${this.when.getTime()}/${t}`;
      task.id = tid;
      //console.log(`tid = ${tid}`);
      if (tids.length == 0) {
        let newItem = `${task.item} #${tid}`;
        task.item = newItem;
        newText = spliceSlice(newText, task.index, task.item.length, newItem);
      }
    }
    if (newText != text) {
      await this.wrtHandler(newText, fname);
    }
    return todos;
  }

  async mergeTodos(todos, text, fname) {
    var newText = text;
    const dated = moment(fname, this.dateFmt);
    var byDate;
    if (dated.isValid() && dated.year() > 2000) {
      byDate = ret.dated[fname] = [];
    }

    todos.map((task, n) => {
      //task.touched = stats.mTimeMs;
      if (task.done) {
        this.taskData.done[task.id] = (task);
        if (this.taskData.pending[task.id]) {
          delete(this.taskData.pending[task.id]);
        }
        const dones = task.tags.filter(tag => {
          return tag.startsWith('done-');
        });
        if (dones.length == 0) {
          let tag = `done-${this.when.getTime()}`;
          let newItem = `${task.item} #${tag}`;
          this.taskData.done[task.id].item = newItem;
          newText = spliceSlice(newText, task.index, task.item.length, newItem);
        }
      } else {
        this.taskData.pending[task.id] = (task);
        if (this.taskData.done[task.id]) {
          delete(this.taskData.done[task.id]);
        }
      }
      if (byDate) {
        byDate.push(task);
      }
      task.tags.filter(t => (! (t.startsWith("uid") || t.startsWith("done-")))).map(t => {
        if (!this.taskData.tagged[t]) {
          this.taskData.tagged[t] = [];
        }
        this.taskData.tagged[t].push(task);
      });

    });
    if (newText !== text) {
      await this.wrtHandler(newText, fname);
    }
  }

  async generateAll(fileCache) {

    await this.readPath(".", fileCache);
    //console.log(JSON.stringify(todos, [], 3));
  }

  deleteTodosFor(forPath) {
    for (const cat in this.taskData) {
      const todosGrp = this.taskData[cat];
      if (todosGrp instanceof Array) {
        this.taskData[cat] = todosGrp.filter((item) => (item.source !== forPath));
      } else { // objects with keys
        for (var nTitle in todosGrp) {
          this.taskData[cat][nTitle] = this.taskData[cat][nTitle].filter((item) => (item.source !== forPath));
        }
      }
    }
  }

  outputTodos() {

    for (const cat in this.taskData) {

      var output = '';
      const todosGrp = this.taskData[cat];
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

  async scanAll(fileCache) {
    await this.generateAll(fileCache);
    this.outputTodos();
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

  findTodos(data, name) {
    // returns them last to first so string replacement is easier
    return findAll(data, name).sort((a, b) => (b.index - a.index));
  }

};

module.exports = mtd;

// a tool to  make todos in my obsidian journal
//
//
const moment = require("moment");
const fs = require("fs");
const path = require("path");
const {
  basename
} = require("path");

const todoMarker = /^\s*- \[[ ,x]\]\s+/gm;
const markMarker = /\((ok|id):([\d,\.]+)\)/gm;
const todoWithTask = /^\s*[-,\*] \[([ ,x])\]\s+(\S.*)$/gm;
const todoTitle = /# Todo/gm;
const nextLine = /\n/gm;
const tagMarker = /#(\S+)/gm;

const tags = /#\S+/;

findMarks = (input) => {
  var ret = {};
  const matchIt = input.matchAll(markMarker);
  const matches = Array.from(matchIt);

  for (var i = 0; i < matches.length; i++) {
    const match = matches[i];
    const type = match[1];
    const val = match[2];
    ret[type] = val;
  }
  return ret;
};

findAnyMarks = (input, source) => {

  var ret = [];
  var match;
  while (match = markMarker.exec(input)) {
    const idx = markMarker.lastIndex - match[2].length;
    ret.unshift({
      "index": match.index,
      "type": match[1],
      "val": match[2],
      "length": markMarker.lastIndex - match.index
    });
  }
  return ret;
};

findTags = (input) => {

  var ret = [];
  const matchIt = input.matchAll(tagMarker);
  const matches = Array.from(matchIt);

  for (var i = 0; i < matches.length; i++) {
    const match = matches[i];
    const tag = match[1].substr(1);
    ret.push(match[1]);
  }
  return ret;
};

findAll = (input, source) => {

  var ret = [];
  var match;
  while (match = todoWithTask.exec(input)) {
    const done = match[1] == 'x';
    const idx = todoWithTask.lastIndex - match[2].length;
    ret.push({
      "index": idx,
      "done": done,
      "item": match[2],
      "source": source
    });
  }
  return ret;
};

toMap = (obj) => {
  var ret = new Map();
  for (const k in obj) {
    ret.set(k, obj[k]);
  }
  return ret;
};

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
      "sources": {},
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
    }
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
    return (td && td.pending) ? toMap(td.pending) : new Map();
  }

  get doneMap() {
    let td = this.taskData;
    return (td && td.done) ? toMap(td.done) : new Map();
  }

  get taggedMap() {
    let td = this.taskData;
    return (td && td.tagged) ? toMap(td.tagged) : new Map();
  }

  async markTasks(todos, text, fname) {
    var newText = text;
    var count = 1;
    for (const t in todos) {
      const task = todos[t];
      var newItem = task.item;
      const marks = findMarks(task.item);
      if (marks["id"]) {
        task.id = marks['id'];
      } else {
        task.id = `${moment(this.when).format("YYYYMMDD")}.${count}`;
        newItem = `${newItem} (id:${task.id})`;
      }
      if (task.done == true) {
        if (marks["ok"]) {} else {
          let compTime;
          try {
            compTime = this.when.getTime();
          } catch (e) {
            console.log("Ooops!");
          }
          newItem = `${newItem} (ok:${compTime})`;
          task.doneStamp = compTime;
        }
      }
      if (newItem.length !== task.item.length) {
        newText = spliceSlice(newText, task.index, task.item.length, newItem);
        task.item = newItem;
      }
      count++;
    }
    if (newText != text) {
      await this.wrtHandler(newText, fname);
    }
    return todos;
  }

  async clearMarks(todos, text, fname) {
    var newText = text;
    var count = 1;
    for (const t in todos) {
      const task = todos[t];
      var newItem = task.item;
      const marks = findAnyMarks(task.item);
      for (const m in marks) {
        let mark = marks[m];
        let loc = task.index + mark.index;
        newText = spliceSlice(newText, loc, mark.length, '');
      }
    }
    if (newText != text) {
      await this.wrtHandler(newText, fname);
    }
    return todos;
  }

  async mergeTasks(todos, fname) {
    let data = this.taskData;
    const dated = moment(fname, this.dateFmt);
    var byDate;
    if (dated.isValid() && dated.year() > 2000) {
      byDate = data.dated[fname] = [];
    }
    let tempSrc = {};
    if (!data.sources) {
      data.sources = {};
    }
    let bySrc = data.sources[fname];
    todos.map((task, n) => {
      //task.touched = stats.mTimeMs;
      tempSrc[task.id] = task.done;
      if (task.done) {
        data.done[task.id] = (task);

        if (data.pending[task.id]) {
          delete(data.pending[task.id]);
        }
      } else {
        data.pending[task.id] = (task);
        if (data.done[task.id]) {
          delete(data.done[task.id]);
        }
      }

      if (byDate) {
        byDate.push(task);
      }
      if (task.tags) {
        task.tags.map(t => {
          if (!this.taskData.tagged[t]) {
            this.taskData.tagged[t] = [];
          }
          this.taskData.tagged[t].push(task);
        });
      }

    });
    // look for deletions
    let origSrc = data.sources[fname];
    if (origSrc) {
      for (const o in origSrc) {
        if (tempSrc[o] === undefined) {
          if (origSrc[o]) {
            this.deleteFromTagged(data.done[o]);
            delete(data.done[o]);
          } else {
            this.deleteFromTagged(data.pending[o]);
            delete(data.pending[o]);
          }
        }
      }
    }
    data.sources[fname] = tempSrc;
  }

  deleteFromTagged(task) {
    if (task.tags) {
      task.tags.map(t => {
        let taggedT = this.taskData.tagged[t];
        if (taggedT) {
          this.taskData.tagged[t] = taggedT.filter(td => (t.id === task.id));
          if (this.taskData.tagged[t].length === 0) { 
            delete(this.taskData.tagged[t]);
          }
        }
      });
    }
  }

  deleteTasksFor(forPath) {
    for (const cat in this.taskData) {
      const todosGrp = this.taskData[cat];
      if (todosGrp instanceof Array && todosGrp.length !== 0) {
        this.taskData[cat] = todosGrp.filter((item) => (item.source !== forPath));
      } else { // objects with keys
        for (var nTitle in todosGrp) {
          const item = this.taskData[cat][nTitle];
          if (item instanceof Array) {
            this.taskData[cat][nTitle] = item.filter((item) => (item.source === forPath));
            if (this.taskData[cat][nTitle].length === 0) {
              delete(this.taskData[cat][nTitle]);
            }
          } else {
            if (item.source === forPath) {
              delete(this.taskData[cat][nTitle]);
            }
          }
        }
      }
    }
  }

  findTasks(data, name) {
    // returns them last to first so string replacement is easier
    return findAll(data, name).sort((a, b) => (b.index - a.index));
  }

}

module.exports = mtd;

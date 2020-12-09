// a tool to  make todos in my obsidian journal
//
//

const {
  Command
} = require("commander");
const toml = require("toml");
const moment = require("moment");
const fs = require("fs");

const fsPromises = fs.promises;

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

taskapi.writeHandler = async (text, fpath) => {
  await fsPromises.writeFile(fpath, text);
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
        taskapi.markTasks(todos, text, fPath);
      }

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

var ignoreDirs = [genLoc, dotLoc];
if (config.ignoreDirs) {
  for (const dir in config.ignoreDirs)
    ignoreDirs.push(path.join(baseLoc, config.ignoreDirs[dir]));
}

console.log(`ignoreDirs: ${ignoreDirs}`);
watchedPath = (fpath) => {
  for (const id in this.ignoreDirs) {
    if (fpath.startsWith(this.ignoreDirs[id])) {
      return false;
    }
  }
  return true;
};

const main = async () => {
  console.log(`run against: ${baseLoc}`);
  await readPath(".");

};
main();

// a tool to  make todos in my obsidian journal
//
//
const { Command } = require("commander");
const moment = require("moment");
const fs = require("fs");
const {findInsert} = require("./todoparse");

const dirLoc = `${process.env.HOME}/DropBox/Journal/_Daily`;
const datefmt = "YYYY-MM-DD";

var when = moment(Date.now()); // when is a moment object
console.log(when);

const prog = new Command();

prog.version('0.0.1');
prog.option('-d, --debug', 'output expra debugging')
.option('-w, --when-do <when>', 'when to do the thing to do');

prog.parse(process.argv);
if (prog.whenDo)
{
    console.log('-whenDo '+prog.whenDo);

    const testSimple = parseInt(prog.whenDo);
    if (! isNaN(testSimple)){
        console.log(`testSimple ${testSimple}`)
        if  (testSimple <  0){
            console.log(`subtracting ${-testSimple}`);
            when.subtract(-testSimple,'d');
            console.log(when);
        }
        else{
            when.add(testSimple,'d');
        }
    }
}
    const fileName = `${when.format(datefmt)}.md`;
    const targetFile = `${dirLoc}/${fileName}`;

    console.log(targetFile);

    function addItem(err, data){
        console.log(data);
        findInsert(data);

    };

    const fData = fs.readFile(targetFile, "UTF-8", addItem);
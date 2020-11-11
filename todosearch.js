
const todoMarker=/^\s*- \[[ ,x]\]\s+/gm;
const markMarker=/\((ok|id):(\d+)\)/gm;
const todoWithTask =/^\s*[-,\*] \[([ ,x])\]\s+(\S.*)$/gm;
const todoTitle=/# Todo/gm;
const nextLine = /\n/gm;
const tagMarker=/#(\S+)/gm;

const tags = /#\S+/;
exports.findTags = (input) => {

    var ret = [];
    const matchIt = input.matchAll(tagMarker);
    const matches = Array.from(matchIt);

    for (var i = 0; i < matches.length ; i++){
        const match = matches[i];
        const tag = match[1].substr(1);
        ret.push(match[1]);
    }
    return ret;
};

exports.findAll = (input,source) => {

    var ret = [];
    var match;
    while (match = todoWithTask.exec(input)){
        const done = match[1] == 'x';
        const idx = todoWithTask.lastIndex - match[2].length;
        ret.push({"index": idx ,"done": done, "item":match[2], "source": source});
    }
    return ret;
}

exports.findInsert = (input) => {
    var insertLoc = input.length;
    const matchIt = input.matchAll(todoMarker);
    const matches = Array.from(matchIt);

    if (matches && matches.length > 0){

        const last = matches[matches.length - 1];
        const lastLoc = last.index + last[0].length;
        const nextLoc = input.substr(lastLoc).search(nextLine);
        if (nextLoc >= 0) { insertLoc = nextLoc + lastLoc;}
    }
    else {
        console.log('look for # Todo');
        const matchT = input.matchAll(todoTitle);
        const matches_t = Array.from(matchT);
        if (matches_t && matches_t.length > 0){
            console.log('found # Todo');
            const last = matches_t[matches_t.length-1];
            const lastLoc = last.index + last[0].length;
            console.log(`${ lastLoc }`);
            const nextLoc = input.substr(lastLoc).search(nextLine);
            if (nextLoc >= 0) { insertLoc = nextLoc + lastLoc;}
        }
    }
    return insertLoc;


  };
/*
  let test1 = `[[2020-08-29|<< Yesterday]] | [[2020-08-31|Tomorrow >>]]

  # Energy

  # Todo
  - [ ] test

  # Stuff
  `;

  let test2 = `[[2020-08-29|<< Yesterday]] | [[2020-08-31|Tomorrow >>]]

  # Energy

  # Todo
  - [ ] test

  # Stuff
  - [ ] test2
  `;

  let testX = `[[2020-08-29|<< Yesterday]] | [[2020-08-31|Tomorrow >>]]

  # Energy

  # Todo
  - [ ] test

  # Stuff
  - [ ] test2

  * [ ] test3 - [ ]
  - [x] test test test 4
  * [ ] `;

  let test0_res = exports.findAll(testX);
  console.log(test0_res);

let test1_res = exports.findInsert(test1);
console.log(test1.length);
console.log(test1_res);



let test2_res = exports.findInsert(test2);
console.log(test2.length);
console.log(test2_res);


  let test3 = `[[2020-08-29|<< Yesterday]] | [[2020-08-31|Tomorrow >>]]

  # Energy

  # Todo

  # Stuff
  `;

test3_res = exports.findInsert(test3);
console.log(test3.length);
console.log(test3_res);
*/

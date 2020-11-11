# MTD - Markdown Task Manager

## Introduction

MTD is a simple manager of todo/tast items.  It works within a directory of markdown formatted files.  The goal is to allow me to just keep track of any checklist items that exist within any markdown file.

For purposes of this tool, "keeping track" means to produce and maintain summary reports of all the todos that are incomplete, complete, and also by tag and by date.  

It runs as a commandline tool and when it is running it watches all the files in the markdown vault and updates its reports as those files change.  

## Design

It is not meant to be a seemless, bulletproof tasklist manager, it is meant to be "good enough" and to co-exist with other tools operating on markdown files.  

It finds task items by searching every changed file for the pattern "^ - \[( ,x)\]".  It only recogizes one line within a file as a task item

### Tags

The in order to allow for flexibility it actually uses its own special mark up within task items.  

When it detects a task/checklist item it adds a "uid" tag to end of the line.  The tag is just the string "UID-" followed by a number (and the number is nothing more than the javascript timestamp ms since 1970). And that string is parenthesized just to be super specific

When an item is marked complete ( " - [x]") a completion timestamp is added: ("done-<timestamp>")

### Reports

The reports are placed in a directory that is ignored by the tool in order to avoid looping over self-modified files.




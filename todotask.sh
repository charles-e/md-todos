#!/bin/sh

find $HOME/Dropbox/Journal -name '*.md' -print0 | xargs -0 sed -i "" "s/# To Do/# Tasks/g"

# Overview

Easily work with LESS files in Visual Studio Code.

"Compile-on-save" for [LESS stylesheets](http://lesscss.org/) without using a build task.

---

# Additions

- 1. Source and Output Directories
- After installation. paste the correct source and output directories into your settings.json
- ```javascript
  "less.compile" : {
    "sourceDir": "${workspaceFolder}/less/",
    "outputDir": "${workspaceFolder}/css/"
    }
  ```
- 2. Partials and Imports Tracking

# Basic Usage

1.  Create a `.less` file.
2.  Hit Ctrl/Cmd+S to save your file.
3.  A `.css` file is automatically generated in the correct folder/subfolder. (You do not need to specify the out in each file as previously required for dynamic storage).
4.  When you save an imported `.less` partial, Easy LESS v2 also recompiles `.less` files that import it
    E.g. if xxx.less imports yyy.less, when yyy.less is edited, yyy.css as well as xxx.css will be re-generated.

5.  You should see a temporary "Less compiled in _**X**_ ms" message in the status bar.

N.B. Also available from the command palette as "Compile LESS to CSS".

# Credits

See Easy Less Plugin Readme

```

```

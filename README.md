# Overview

Easily work with LESS files in Visual Studio Code.

"Compile-on-save" for [LESS stylesheets](http://lesscss.org/) without using a build task.

---

# Settings

- After installation. paste the following settings into your settings.json
- ```javascript
  "less.compile" : {
    "sourceDir": "${workspaceFolder}/less/",
    "outputDir": "${workspaceFolder}/css/"
    }
  ```

```

# Basic Usage

1.  Create a `.less` file.
2.  Hit Ctrl/Cmd+S to save your file.
3.  A `.css` file is automatically generated in the correct subfolder.
4.  When you save an imported `.less` partial, Easy LESS v2 also recompiles `.less` files that import it
5.  You should see a temporary "Less compiled in _**X**_ ms" message in the status bar.

N.B. Also available from the command palette as "Compile LESS to CSS".

# Credits

See Easy Less Plugin readme
```

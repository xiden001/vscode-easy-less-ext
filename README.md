# Overview

Easily work with LESS files in Visual Studio Code.

"Compile-on-save" for [LESS stylesheets](http://lesscss.org/) without using a build task.

---

# Settings

- After installation. paste the following settings into your settings.json
- "less.compile" : {
  "sourceDir": "${workspaceFolder}/less/",
  "outputDir": "${workspaceFolder}/css/"
  }

# Basic Usage

1.  Create a `.less` file.
2.  Hit Ctrl/Cmd+S to save your file.
3.  A `.css` file is automatically generated.
4.  You should see a temporary "Less compiled in _**X**_ ms" message in the status bar.

N.B. Also available from the command palette as "Compile LESS to CSS".

# credits

See Easy Less Plugin readme

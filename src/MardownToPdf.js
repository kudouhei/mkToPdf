const fs = require('fs');
const os = require('os');
const path = require('path');
const url = require('url');
const URI = require('vscode-uri').URI

const Types = ["pdf"];

function hasExistPath(path) {
    if (path.length === 0) {
        return false;
    }
    try {
        fs.accessSync(path);
        return true;
    } catch (e) {
        console.log(e.message)
        return false;
    }
}

function ToImgPath(src, filename) {
    let href = decodeURIComponent(src);
    href = href.replace(/("|")/g, "").replace(/\\/g, "/").replace(/#/g, "%23");

    let protocol = url.parse(href).protocol

    if (protocol === "file:" && href.indexOf("file:///") !==0) {
      return href.replace(/^file:\/\//, "file:///")
    } else if (protocol === "file:") {
      return href
    } else if (!protocol || path.isAbsolute(href)) {
      href = path.resolve(path.dirname(filename), href).replace(/\\/g, "/").replace(/#/g, "%23");

      if (href.indexOf("//") === 0) {
        return "file:" + href
      } else if (href.indexOf("/") === 0) {
        return "file://" + href
      } else {
        return "file:///" + href
      }
    } else {
      return src
    }
    
}

function slug(string) {
    try {
      let stg = encodeURI(string.trim()
        .toLowerCase()
        .replace(/[\]\[\!\"\#\$\%\&\"\(\)\*\+\,\.\/\:\;\<\=\>\?\@\\\^\_\{\|\}\~\`]/g, "")
        .replace(/\s+/g, "-")
        .replace(/^\-+/, "")
        .replace(/\-+$/, ""))

      return stg;
    } catch (error) {
      showErrorMessage("slug()", error)
    }
}

function readFile(filename, encode) {
    if (filename.length === 0) {
        return ''
    }
    if (!encode && encode !== null) {
        encode = "utf-8"
    }
    if (filename.indexOf("file://") === 0) {
        if (process.platform === "win32") {
          filename = filename.replace(/^file:\/\/\//, "")
                     .replace(/^file:\/\//, "")
        } else {
          filename = filename.replace(/^file:\/\//, "")
        }
    }
    if (hasExistPath(filename)) {
        return fs.readFileSync(filename, encode)
    } else {
        return ""
    }
}

function makeCss(filename) {
    let css = readFile(filename);
    if (css) {
        return "\n<style>\n" + css + "\n</style>\n"
    } else {
        return ""
    }
}

function handleHref(resource, href, config) {
    if (!href) {
        return href
    }
  
    // Use href if it is already an URL
    let hrefUri = URI.parse(href)
    if (["http", "https"].indexOf(hrefUri.scheme) >= 0) {
        return hrefUri.toString();
    }
  
    // Use a home directory relative path If it starts with ^.
    if (href.indexOf("~") === 0) {
        return URI.file(href.replace(/^~/, os.homedir())).toString()
    }

    // Use href as file URI if it is absolute
    if (path.isAbsolute(href) || hrefUri.scheme === "file") {
        return URI.file(href).toString()
    }

    // Use a workspace relative path if there is a workspace and markdown-pdf.stylesRelativePathFile is false
    let stylesRelativePathFile = config["stylesRelativePathFile"]
    let root = getFolder(resource)
    if (stylesRelativePathFile === false && root) {
        return URI.file(path.join(root.uri.fsPath, href)).toString()
    }

    // Otherwise look relative to the markdown file
    return URI.file(path.join(path.dirname(resource.fsPath), href)).toString()
}

function readStyles(uri, config) {
    let includeDefaultStyles = config["includeDefaultStyles"];
    let style = ""
    let styles = ""
    let filename = ""
    let i

    // default styles
    if (includeDefaultStyles) {
        filename = path.join(__dirname, "styles", "markdown.css");
        style += makeCss(filename);
    }
    // style of the markdown.styles
    if (includeDefaultStyles) {
        styles = config["styles"]
        if (styles && Array.isArray(styles) && styles.length > 0) {
          for (i = 0; i < styles.length; i++) {
            let href = handleHref(uri, styles[i])
            style += "<link rel=\"stylesheet\" href=\"" + href + "\" type=\"text/css\">"
          }
        }
    }
    // style of the highlight.js
    let highlightStyle = config['highlightStyle'] || "";
    let isHighlight = config["highlight"];
    if (isHighlight) {
        if (highlightStyle) {
            let cssPath = config["highlightStyle"] || "github"
            let useBuiltInHighlightStyle = !cssPath.endsWith(".css")
    
            filename = useBuiltInHighlightStyle
              ? path.join(__dirname, "node_modules", "highlight.js", "styles", cssPath, ".css")
              : cssPath
    
            style += makeCss(filename)
        } else {
            filename = path.join(__dirname, "styles", "hljs.css")
            style += makeCss(filename)
        }
    }
    // markdown-pdf style
    if (includeDefaultStyles) {
        filename = path.join(__dirname, "styles", "markdown-pdf.css");

        style += makeCss(filename);
    }
    // markdown-pdf style settings
    styles = config["styles"] || ""

    if (styles && Array.isArray(styles) && styles.length > 0) {
      for (i = 0; i < styles.length; i++) {
        let href = fixHref(uri, styles[i]);
        style += "<link rel=\"stylesheet\" href=\"" + href + "\" type=\"text/css\">"
      }
    }

    return style;
}

function fixHref(resource, href, config) {
    try {
      if (!href) {
        return href
      }
  
      // Use href if it is already an URL
      let hrefUri = URI.parse(href)
      if (["http", "https"].indexOf(hrefUri.scheme) >= 0) {
        return hrefUri.toString()
      }
  
      // Use a home directory relative path If it starts with ^.
      if (href.indexOf("~") === 0) {
        return URI.file(href.replace(/^~/, os.homedir())).toString()
      }
  
      // Use href as file URI if it is absolute
      if (path.isAbsolute(href) || hrefUri.scheme === "file") {
        return URI.file(href).toString()
      }
  
      // Use a workspace relative path if there is a workspace and markdown-pdf.stylesRelativePathFile is false
      let stylesRelativePathFile = config["stylesRelativePathFile"]
      let root = getFolder(resource)
      if (stylesRelativePathFile === false && root) {
        return URI.file(path.join(root.uri.fsPath, href)).toString()
      }
  
      // Otherwise look relative to the markdown file
      return URI.file(path.join(path.dirname(resource.fsPath), href)).toString()
    } catch (error) {
      showErrorMessage("fixHref()", error)
    }
  }

async function markdownToPdf(inputMdFile, outputFilePath, outputFileType, config) {
    try {
        let ext = path.extname(inputMdFile);
        if (!hasExistPath(inputMdFile)){
            console.log("File does not exist!")
            return
        }

        let uri = URI.file(inputMdFile);
        let types_array = Types;
        let filename = '';
        let types = [];
        if (types_array.indexOf(outputFileType) >= 0) {
            types[0] = outputFileType;
        } else if (outputFileType === 'settings'){
            let types_tmp = config["types"] || 'pdf';
            if (types_tmp && !Array.isArray(types_tmp)) {
                types[0] = types_tmp
            } else {
              types = config["type"] || "pdf"
            }
        } else {
            console.log(`only supported: ${Types.join(", ")}`);
            return;
        }

        // convert
        if (types && Array.isArray(types) && types.length > 0) {
            for (let i = 0; i < types.length; i++) {
                let type = types[i];
                if (types_array.indexOf(type) >= 0) {
                    filename = inputMdFile.replace(ext, "." + type);
                    let content = fs.readFileSync(inputMdFile).toString();

                    let content_html = convertMdToHtml(inputMdFile, type, content, config);

                    let html = makeHtml(content_html, uri, config);

                    await exportPdf(html, filename, outputFilePath, type, uri, config)
                }
            }
        }

    } catch (err) {
        console.log("ERROR: markdownToPdf()" + err)
    }
}

function convertMdToHtml(filename, type, content, config) {
    let md = {};

    try {
        let hljs = require("highlight.js");
        let breaks = config["breaks"];

        md = require("markdown-it")({
            html: true,
            breaks: breaks,
            highlight: function(str, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    str = hljs.highlight(str, { language: lang }, true).value;
                } else {
                    str = md.utils.escapeHtml(str);
                }
                return "<pre class='hljs'><code><div>" + str + "</div></code></pre>"
            }
        })
    } catch (err) {
        console.log("ERROR:", err);
    }

    // convert the img src of the markdown
    // cheerio parse HTML -->  Crawl a web page
    let cheerio = require("cheerio")
    let defaultRender = md.renderer.rules.image;

    md.renderer.rules.image = function (tokens, idx, options, env, self) {
        let token = tokens[idx];
        let href = token.attrs[token.attrIndex("src")][1];

        href = ToImgPath(href, filename);

        token.attrs[token.attrIndex("src")][1] = href;

        return defaultRender(tokens, idx, options, env, self);
    }

    if (type !== "html") {
        // convert the img src of the html
        md.renderer.rules.html_block = function (tokens, idx) {
          let html = tokens[idx].content
          let $ = cheerio.load(html);

          $("img").each(function () {
            let src = $(this).attr("src");
            let href = ToImgPath(src, filename);
            $(this).attr("src", href);
          })

          return $.html();
        }
    }

    // checkbox
    md.use(require("markdown-it-checkbox"));

    let options = {
        slugify: slug
    }
    md.use(require("markdown-it-named-headers"), options);

    md.use(require("markdown-it-container"), "", {
        validate: function(name) {
            return name.trim().length;
        },
        render: function (tokens, idx) {
            if (tokens[idx].info.trim() !== "") {
                return `<div class="${tokens[idx].info.trim()}">\n`
            } else {
                return `</div>\n`
            }
        }
    });

    return md.render(content);
}

function makeHtml(data, uri, config) {
    let style = '';
    style += readStyles(uri, config);

    let title = path.basename(uri.fsPath);

    // template
    let filename = path.join(__dirname, "template", "template.html");
    let template = readFile(filename);

    // compile template
    let mustache = require("mustache");

    let view = {
        title: title,
        style: style,
        content: data
    }
    return mustache.render(template, view);
}

function getOutputDir(filename, resource, config) {
    let outputDir;
    if (resource === undefined) {
        return filename;
    }
    let outputDirectory = config["outputDirectory"] || ""
    if (outputDirectory.length === 0) {
      return filename
    }

    // Use a home directory relative path If it starts with ~.
    if (outputDirectory.indexOf("~") === 0) {
        outputDir = outputDirectory.replace(/^~/, os.homedir());
        mkdir(outputDir)
        return path.join(outputDir, path.basename(filename))
    }

    // Use path if it is absolute
    if (path.isAbsolute(outputDirectory)) {
        if (!isExistsDir(outputDirectory)) {
            return
        }
        return path.join(outputDirectory, path.basename(filename))
    }
    
    // Use a workspace relative path if there is a workspace and markdown-pdf.outputDirectoryRootPath = workspace
    let outputDirectoryRelativePathFile = config["outputDirectoryRelativePathFile"]
    let root = getFolder(resource)
    
    if (outputDirectoryRelativePathFile === false && root) {
        outputDir = path.join(root.uri.fsPath, outputDirectory)
        mkdir(outputDir)
        return path.join(outputDir, path.basename(filename))
    }
    
    // Otherwise look relative to the markdown file
    outputDir = path.join(path.dirname(resource.fsPath), outputDirectory)
    mkdir(outputDir)
    return path.join(outputDir, path.basename(filename))
}

function getFolder(resource) {
    return {
      index: 0,
      name: path.basename(resource.path),
      uri: URI.file(path.dirname(resource.path))
    }
}

function mkdir(path) {
    if (isExistsDir(path)) {
      return
    }
    let mkdirp = require("mkdirp")
    return mkdirp.sync(path)
}

function isExistsDir(dirname) {
    if (dirname.length === 0) {
        return false;
    }
    try {
        if (fs.statSync(dirname).isDirectory()) {
            return true;
        }
    } catch (e) {
        console.log(e.message)
    }
}

function exportHtml(data, filename) {
    fs.writeFile(filename, data, "utf-8", function (error) {
      if (error) {
        console.log(error)
        return
      }
    })
}

function deleteFile (path) {
    let rimraf = require("rimraf")
    rimraf(path, function(error) {
      if (error) throw error
    })
}

async function exportPdf(data, filename, outputFilePath, type, uri, config) {
    console.log("Exporting (" + type + ") ...")

    let exportFilename = outputFilePath || getOutputDir(filename, uri, config);

    try {
        const puppeteer = require("puppeteer");
        let f = path.parse(filename)
        let tmp_filename = path.join(f.dir, f.name + "_tmp.html")
        exportHtml(data, tmp_filename);

        let options = {
            executablePath: config["executablePath"] || undefined,
            args: undefined
        }

        let browser = await puppeteer.launch(options).catch(error => {
            console.log("puppeteer.launch()", error)
        })
        let page = await browser.newPage().catch(error => {
            console.log("browser.newPage()", error)
        });
        await page.goto(URI.file(tmp_filename).toString(), { waitUntil: "networkidle0" }).catch(error => {
            console.log("page.goto()", error)
        });

        if (type === "pdf") {
            let width_option = config["width"] || ""
            let height_option = config["height"] || ""
            let format_option = ""
            if (!width_option && !height_option) {
              format_option = config["format"] || "A4"
            }
            let landscape_option
            if (config["orientation"] == "landscape") {
              landscape_option = true
            } else {
              landscape_option = false
            }
            let options = {
              path: exportFilename,
              scale: config["scale"],
              displayHeaderFooter: config["displayHeaderFooter"],
              headerTemplate: config["headerTemplate"] || "",
              footerTemplate: config["footerTemplate"] || "",
              printBackground: config["printBackground"],
              landscape: landscape_option,
              pageRanges: config["pageRanges"] || "",
              format: format_option,
              width: config["width"] || "",
              height: config["height"] || "",
              margin: {
                top: config["margin"]["top"] || "",
                right: config["margin"]["right"] || "",
                bottom: config["margin"]["bottom"] || "",
                left: config["margin"]["left"] || ""
              }
            }
            await page.pdf(options).catch(error => {
              console.log("page.pdf", error)
            })
        }

        await browser.close();

        let debug = config["debug"] || false
        if (!debug) {
          if (hasExistPath(tmp_filename)) {
            deleteFile(tmp_filename)
          }
        }
    
        console.log("Exported to file: " + exportFilename)
    } catch (err) {
        console.error(err)
    }
}

module.exports = {
    markdownToPdf
}
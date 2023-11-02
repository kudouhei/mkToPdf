#! /usr/bin/env node
const fs = require("fs")
const path = require("path")
const yargs = require("yargs")

const Types = ["pdf"];
const mdPdf = require("../index");
const mdPdfData = require("../package.json");

function getVersionFromPackageJson() {
    return mdPdfData.version;
}

function parseArguments() {
    return yargs.version(getVersionFromPackageJson())
        .epilogue(`Convert from markdown to ${Types.join("/")} with styles`)
        .option("input", {
            alias: "i",
            describe: "Path to a valid markdown file",
            type: "string"
        })
        .option("output", {
            alias: "o",
            describe: "Output file path",
            type: "string"
        })
        .options("output-type", {
            alias: "t",
            describe: "Format to export",
            default: "pdf",
            choices: Types
        })
        .option("config", {
            alias: "c",
            describe: "Path to the JSON config file to use",
            type: "string",
            default: path.join(__dirname, "..", "config.json")
        })
        .demandOption("input")
        .argv
}

function getOptions() {
    let args = parseArguments();
    let outputDir = args["output-path"];

    if (outputDir) {
        if ((!fs.existsSync(outputDir) || !(fs.statSync(outputDir).isDirectory()))) {
            throw new Error(`ERROR: Output directory '${outputDir}' does not exist or is not a directory`)
        }
        config.outputDirectory = outputDir;
    }
    return {
        markdownFilePath: args.input,
        outputFilePath: args.output,
        outputFileType: args["output-type"],
        configFilePath: args.config
    }
}

async function main() {
    await mdPdf.convertMd(
        getOptions()
    )
}

main()
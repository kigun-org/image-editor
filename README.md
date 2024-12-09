# Image Editor

A free lightweight web-based image editor component, available as a pair
of JS+CSS files ready to be included in any HTML page.

It was initially developed for editing photographs, so it supports large
image sizes (and automatically downsizes the images if they exceed your browser's
canvas size limit).

Online demo: https://photo.kigun.org/

## Building

Download the repository:
```
git clone https://github.com/kigun-org/image-editor
cd image-editor
npm install
```

To build the JS component:
```
npm run buildlib
```

The output should be 2 files, `ImageEditor.js` and `ImageEditor.css`,
which you can include in your website as shown below

## Using

Download the latest release files from GitHub and add the following to your HTML page:

1) The stylesheet, in `<head>`:
```
<link rel="stylesheet" href="/path/to/ImageEditor.css" />
```

2) The script:
```
<script type="module">
    import ImageEditor from '/path/to/ImageEditor.js";

    const props = {
        // ...
    }

    import('/path/to/ImageEditor.js').then((module) => {
        app = new module.default({
            target: document.getElementById("appContainer"),
            props: props
        })
    })
</script>
```

The following options are supported:

- `imageBlob`: an existing image blob (optional). 
  If provided, the editor will load it directly, if not,
  it will open the instructions page, guiding users how to load an image. 
- `validators`: a list of objects of the format:
  ```
  {
    test: A test function receiving an image blob and returning true if it is not valid
    message: A message string to show when the callback returns true
  ```
- `saveCallback`: A function receiving the final image as a blob and returning
  a Promise, which should resolve once the image is saved and reject when an error
  occurs.

### How to run locally

To build the demo website:
```
npm run build
```

To test run the demo website locally:
```
npm run dev
```

The app should be running locally at: https://localhost:5173/.

## FAQ

### Why is a npm package not available?

We're using this library in our projects which generally
follow the [Islands Architecture](https://jasonformat.com/islands-architecture/),
and therefore we need JS and CSS files to include, rather than
the typical npm output.

If there is interest in having an npm package, we may consider
adding it in the future.

## License

This software is licensed under the AGPL v3.0, which basically
means that if you use it in your project, it must also be
open sourced under a similar license (but read the LICENSE file
for the full details).

If you are interested in using the library under a more permissive
license, please contact us (www.kigun.org).
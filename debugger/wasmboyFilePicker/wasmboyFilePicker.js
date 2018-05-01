import { Component } from "preact";
import fetch from "unfetch";
import GooglePicker from "./googlePicker/googlePicker";
import "./wasmboyFilePicker.css";

// Public Keys for Google Drive API
const WASMBOY_DEBUGGER_GOOGLE_PICKER_CLIENT_ID =
  "427833658710-bntpbmf6pimh8trt0n4c36gteomseg61.apps.googleusercontent.com";

// OAuth Key for Google Drive
let googlePickerOAuthToken = "";

export class WasmBoyFilePicker extends Component {
  constructor(props) {
    super(props);
    // set our state to if we are initialized or not
    this.state = {
      currentFileName: "No Game Selected...",
      isFileLoading: false
    };
  }

  // Allow passing a file
  // https://gist.github.com/AshikNesin/e44b1950f6a24cfcd85330ffc1713513
  loadLocalFile(event) {
    this.setFileLoadingStatus(true);
    this.props.wasmboy
      .loadGame(event.target.files[0])
      .then(() => {
        console.log("Wasmboy Ready!");
        this.props.showNotification("Game Loaded! 🎉");
        this.setFileLoadingStatus(false);
      })
      .catch(error => {
        console.log("Load Game Error:", error);
        this.props.showNotification("Game Load Error! 😞");
        this.setFileLoadingStatus(false);
      });

    // Set our file name
    const newState = Object.assign({}, this.state);
    newState.currentFileName = event.target.files[0].name;
    this.setState(newState);
  }

  loadGoogleDriveFile(data) {
    if (data.action === "picked") {
      // Fetch from the drive api to download the file
      // https://developers.google.com/drive/v3/web/picker
      // https://developers.google.com/drive/v2/reference/files/get

      const googlePickerFileObject = data.docs[0];
      const oAuthHeaders = new Headers({
        Authorization: "Bearer " + googlePickerOAuthToken
      });

      this.setFileLoadingStatus(true);

      // First Fetch the Information about the file
      fetch(
        "https://www.googleapis.com/drive/v2/files/" +
          googlePickerFileObject.id,
        {
          headers: oAuthHeaders
        }
      )
        .then(response => {
          return response.json();
        })
        .then(responseJson => {
          // Finally fetch the file
          fetch(responseJson.downloadUrl, {
            headers: oAuthHeaders
          })
            .then(blob => {
              if (!blob.ok) {
                return Promise.reject(blob);
              }

              return blob.arrayBuffer();
            })
            .then(bytes => {
              // Use Wasm Boy to possibly Unzip, and then pass the bytes to be loaded
              this.props.wasmboy
                ._getGameFromArrayBuffer(googlePickerFileObject.name, bytes)
                .then(byteArray => {
                  this.props.wasmboy
                    .loadGame(byteArray)
                    .then(() => {
                      console.log("Wasmboy Ready!");
                      this.props.showNotification("Game Loaded! 🎉");
                      this.setFileLoadingStatus(false);

                      // Set our file name
                      const newState = Object.assign({}, this.state);
                      newState.currentFileName = googlePickerFileObject.name;
                      this.setState(newState);
                    })
                    .catch(error => {
                      console.log("Load Game Error:", error);
                      this.props.showNotification("Game Load Error! 😞");
                      this.setFileLoadingStatus(false);
                    });
                })
                .catch(error => {
                  this.props.showNotification(
                    "Error getting file from google drive 💔"
                  );
                  this.setFileLoadingStatus(true);
                });
            })
            .catch(error => {
              this.props.showNotification(
                "Error getting file from google drive 💔"
              );
              this.setFileLoadingStatus(true);
            });
        })
        .catch(error => {
          this.props.showNotification(
            "Error getting file from google drive 💔"
          );
          this.setFileLoadingStatus(true);
        });
    }
  }

  setFileLoadingStatus(isLoading) {
    const newState = Object.assign({}, this.state);
    newState.isFileLoading = isLoading;
    this.setState(newState);
  }

  render() {
    let fileInput = (
      <div class="wasmboy__filePicker__services">
        <div class="donut" />
      </div>
    );
    if (!this.state.isFileLoading) {
      fileInput = (
        <div class="wasmboy__filePicker__services">
          {/* Bulma file picker */}
          <div class="file">
            <label class="file-label">
              <input
                class="file-input"
                type="file"
                accept=".gb, .gbc, .zip"
                name="resume"
                onChange={event => {
                  this.loadLocalFile(event);
                }}
              />
              <span class="file-cta">
                <span class="file-icon">
                  {/* Material file svg https://material.io/icons/#ic_insert_drive_file */}
                  <svg
                    fill="#020202"
                    height="24"
                    viewBox="0 0 24 24"
                    width="24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z" />
                    <path d="M0 0h24v24H0z" fill="none" />
                  </svg>
                </span>
                <span class="file-label">Upload from Device</span>
              </span>
            </label>
          </div>

          {/* Google Drive Picker */}
          <GooglePicker
            clientId={WASMBOY_DEBUGGER_GOOGLE_PICKER_CLIENT_ID}
            scope={["https://www.googleapis.com/auth/drive.readonly"]}
            onChange={data => {
              this.loadGoogleDriveFile(data);
            }}
            onAuthenticate={token => {
              googlePickerOAuthToken = token;
            }}
            multiselect={false}
            navHidden={true}
            authImmediate={false}
            viewId={"DOCS"}
          >
            <div class="file">
              <label class="file-label">
                <span class="file-cta">
                  <span class="file-icon">
                    {/* Material file svg https://material.io/icons/#ic_insert_drive_file */}
                    <svg
                      fill="#020202"
                      height="24"
                      viewBox="0 0 24 24"
                      width="24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M0 0h24v24H0z" fill="none" />
                      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z" />
                    </svg>
                  </span>
                  <span class="file-label">Get from Google Drive</span>
                </span>
              </label>
            </div>
          </GooglePicker>
        </div>
      );
    }

    return (
      <div class="wasmboy__filePicker">
        <h1>Load Game</h1>
        <h2>Supported file types: ".gb", ".gbc", ".zip"</h2>
        <h2>{this.state.currentFileName}</h2>
        {fileInput}
      </div>
    );
  }
}

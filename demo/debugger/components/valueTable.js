import { h, Component } from 'preact';
import './valueTable.css';

// Component that takes in a JSON object, where the Keys are the row names,
// And the columns will represent each base value of the number in the value of the key
export default class ValueTable extends Component {
  constructor() {
    super();
    this.state = {
      object: {}
    };

    this.updateInterval = false;
  }

  componentDidMount() {
    this.updateInterval = setInterval(() => this.intervalUpdate(), 100);
  }

  componentWillUnmount() {
    clearInterval(this.updateInterval);
  }

  intervalUpdate() {
    // Should Override this.
  }

  // Modifed from: https://ourcodeworld.com/articles/read/380/how-to-convert-a-binary-string-into-a-readable-string-and-vice-versa-with-javascript
  numberToBinaryString(number) {
    // Simply Convert each place in hex to binary
    const hexString = number.toString(16);

    let binaryString = '';
    for (let i = 0; i < hexString.length; i++) {
      let valueAtIncrementer = parseInt(hexString.charAt(i), 16).toString(2);
      let paddedValueAtIncrementer = valueAtIncrementer;
      // Pad to 4 bits
      while (paddedValueAtIncrementer.length < 4) {
        paddedValueAtIncrementer = '0' + paddedValueAtIncrementer;
      }

      binaryString += paddedValueAtIncrementer;

      if (i !== hexString.length - 1) {
        binaryString += ' ';
      }
    }

    // Padd out to 8 bit increments
    if (!(binaryString.length & 1)) {
      binaryString = '0000 ' + binaryString;
    }

    return binaryString;
  }

  getValueWithBase(value, valueBase) {
    if (valueBase === 16) {
      return value.toString(16);
    } else if (valueBase === 2) {
      return this.numberToBinaryString(value);
    } else {
      return value.toString(10);
    }
  }

  render() {
    if (!this.state.object || Object.keys(this.state.object).length < 1) {
      return (
        <div className="value-table-container">
          <h1>{this.state.title}</h1>
          <div>Please open a ROM to view the state values.</div>
        </div>
      );
    }

    const keyRows = [];
    Object.keys(this.state.object).forEach(objectKey => {
      keyRows.push(
        <tr>
          <th>{objectKey}</th>
          <td>0x{this.getValueWithBase(this.state.object[objectKey], 16)}</td>
          <td>{this.getValueWithBase(this.state.object[objectKey], 2)}</td>
          <td>{this.getValueWithBase(this.state.object[objectKey], 10)}</td>
        </tr>
      );
    });

    return (
      <div className="value-table-container">
        <h1>{this.state.title}</h1>
        {this.state.headerElement}
        <table className="value-table">
          <tr>
            <th>Value</th>
            <td>Hexadecimal:</td>
            <td>Binary:</td>
            <td>Decimal:</td>
          </tr>

          {keyRows}
        </table>
      </div>
    );
  }
}

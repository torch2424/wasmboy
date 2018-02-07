import { Component } from 'preact';

// Component that takes in a JSON object, where the Keys are the column name,
// And the Rows will represent each base value of the number in the value of the key
export class NumberBaseTable extends Component {

  constructor() {
    super();
    this.state = {
      object: {}
    };
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      object: nextProps.object
    });
  }

  // Modifed from: https://ourcodeworld.com/articles/read/380/how-to-convert-a-binary-string-into-a-readable-string-and-vice-versa-with-javascript
  numberToBinaryString(number) {
     // Simply Convert each place in hex to binary
     const hexString = number.toString(16);

     let binaryString = '';
     for(let i = 0; i < hexString.length; i++) {
       let valueAtIncrementer = parseInt(hexString.charAt(i), 16).toString(2);
       let paddedValueAtIncrementer = valueAtIncrementer;
       // Pad to 4 bits
       while(paddedValueAtIncrementer.length < 4) {
         paddedValueAtIncrementer = '0' + paddedValueAtIncrementer
       }

       binaryString += paddedValueAtIncrementer;

       if(i !== hexString.length - 1) {
         binaryString += ' ';
       }
     }

     return binaryString;
  }

  getTableCellsForValueWithBase(valueBase) {
    const tableCells = [];
    Object.keys(this.state.object).forEach((key) => {
      if(valueBase === 16) {
        tableCells.push((
          <td>0x{this.state.object[key].toString(16)}</td>
        ))
      } else if(valueBase === 2) {
        tableCells.push((
          <td>{this.numberToBinaryString(this.state.object[key])}</td>
        ))
      } else {
        tableCells.push((
          <td>{this.state.object[key]}</td>
        ))
      }
    });

    return tableCells;
  }

  getTableCellsForObjectKeys() {
    if(!this.state.object) {
      return (
        <div></div>
      )
    }

    const objectKeysAsTableCells = [];

    Object.keys(this.state.object).forEach((key) => {
      objectKeysAsTableCells.push((
        <th>
          {key}
        </th>
      ))
    });

    return objectKeysAsTableCells;
  }

  render() {

    if(!this.state.object || Object.keys(this.state.object).length < 1) {
      return (
        <div></div>
      )
    }

    return (
      <div className="number-base-table-container">
        <table className="number-base-table">
          <tr>
            <th>Value Base</th>
            {this.getTableCellsForObjectKeys()}
          </tr>

          <tr>
            <td>Hexadecimal:</td>
            {this.getTableCellsForValueWithBase(16)}
          </tr>

          <tr>
            <td>Decimal:</td>
            {this.getTableCellsForValueWithBase(10)}
          </tr>

          <tr>
            <td>Binary:</td>
            {this.getTableCellsForValueWithBase(2)}
          </tr>
        </table>
      </div>
    )
  }
}

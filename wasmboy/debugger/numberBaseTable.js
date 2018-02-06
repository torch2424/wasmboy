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
       let valueAtIncrementer = parseInt(hexString.charAt(i), 16);
       binaryString = valueAtIncrementer + binaryString + ' ';
     }

     return binaryString.toString(2);
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

  render() {

    if(!this.state.object || Object.keys(this.state.object).length < 1) {
      return (
        <div></div>
      )
    }

    return (
      <div>
        <table>
          <tr>
            {Object.keys(this.state.object)}
          </tr>

          <tr>
            {this.getTableCellsForValueWithBase(16)}
          </tr>

          <tr>
            {this.getTableCellsForValueWithBase(10)}
          </tr>

          <tr>
            {this.getTableCellsForValueWithBase(2)}
          </tr>
        </table>
      </div>
    )
  }
}

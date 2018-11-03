export default class BenchmarkRunner extends Component {
  constructor(props) {
    super(props);

    this.state = {
      ROM: null,
      showROMs: false,
      loading: false
    };
  }

  componentDidMount() {
    this.openSourceROMElements = getOpenSourceROMElements(this.loadROMIntoCores.bind(this));
  }

  render() {}
}

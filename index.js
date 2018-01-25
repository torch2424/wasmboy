import './style';
import { Component } from 'preact';
import { WasmboyComponent } from './wasmboy.component.js';

export default class App extends Component {
	render() {
		return (
			<div>
				<h1>Wasmboy</h1>
				<WasmboyComponent></WasmboyComponent>
			</div>
		);
	}
}

import './style';
import { Component } from 'preact';
import { Wasmboy } from './wasmboy.js';

export default class App extends Component {
	render() {
		return (
			<div>
				<h1>Wasmboy</h1>
				<Wasmboy></Wasmboy>
			</div>
		);
	}
}

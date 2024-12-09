import App from './App.svelte'
import { mount } from "svelte";

// Load after our component
import 'bootstrap/dist/css/bootstrap.min.css'

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app

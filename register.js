import CodeMirror from 'codemirror';
import {asyncValidator} from './lintAsync';

CodeMirror.registerHelper('lint', 'javascript', asyncValidator);
import { DirectiveHandler } from "../types/z";
import { processIfDirective } from "./if";
import { processHTMLDirective, processTextDirective } from "./text";

export const DEFAULT_DIRECTIVES: {[index: string]: DirectiveHandler} = {
    'if': processIfDirective,
    'html': processHTMLDirective,
    'text': processTextDirective
}

export default class DirectiveRegistry {
    private static directives: { [index: string]: DirectiveHandler } = DEFAULT_DIRECTIVES;

    public static registerDirective(directive: string, handler: DirectiveHandler): void {
        // TODO: Check handler doesn't exist 
        this.directives[directive] = handler;
    }

    public static getHandler(directive: string) {
        return this.directives[directive];
    }

    public static getHandlerRegex() {
        const keys = Object.keys(this.directives).join('|');

        return new RegExp(`^z-(on|${keys})\\b`);
    }
}
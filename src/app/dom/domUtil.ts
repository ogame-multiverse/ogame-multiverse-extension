import $ from 'jquery';

export class DomUtil {

  public static CreateDomElement(element: string, attributes: Record<string, string>, textContent?: string): JQuery<HTMLElement> {
    //if element is select, then add  dropdownInitialized class by default (ogame rewrites select inputs that do not have the dropdownInitialized class)
    if (element.toLowerCase() === 'select') {
      attributes = {
        ...attributes,
        class: attributes?.class ? attributes.class + ' dropdownInitialized' : 'dropdownInitialized',
      };
    }
    const newElement = $(`<${element}/>`, attributes);
    if (textContent) newElement.text(textContent);
    return newElement;
  }

  public static FindOrCreateElement(parent: JQuery<HTMLElement>, selector: string, element: string, attributes: Record<string, string>, append: boolean, textContent?: string): JQuery<HTMLElement> {
    let $element = parent.find(selector);
    if ($element.length === 0) {
      $element = DomUtil.CreateDomElement(element, attributes, textContent);
      if (append) parent.append($element);
    }
    return $element;
  }
}

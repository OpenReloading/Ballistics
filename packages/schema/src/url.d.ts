// zod's declarations name the WHATWG `URL` type, which every runtime has and the ES library of this package lacks.
// Declared as an empty type, so it merges with the DOM and Node declarations: the schemas call no URL API of their own.
interface URL {}

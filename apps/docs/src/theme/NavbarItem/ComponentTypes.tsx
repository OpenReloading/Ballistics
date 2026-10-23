// biome-ignore lint/correctness/noUndeclaredDependencies: Docusaurus alias for the theme's own component
import ComponentTypes from '@theme-original/NavbarItem/ComponentTypes'
import RepoWidget from '../../components/RepoWidget.tsx'

/** The theme's navbar item types plus `custom-repo` (the repository widget). */
export default { ...ComponentTypes, 'custom-repo': RepoWidget }

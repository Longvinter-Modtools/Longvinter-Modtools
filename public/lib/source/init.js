const querystring = require('querystring');
let query = querystring.parse(global.location.search);
let mods_list = JSON.parse(query['?data']);
let remote_mods_list = JSON.parse(query['remote_mods_list']);
let ver = query['version'];

window.jQuery = require('jquery')

window.onload = async function () {
    storage.clear();

    parse_mods(mods_list);
    await parse_remote_mods(mods_list, remote_mods_list)
    check_local_mod_versions(mods_list);

    document.getElementById('version').innerText = ver;
    openTab('mods-installed', document.getElementsByClassName('nav-item')[0].children[0]);
}
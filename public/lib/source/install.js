/**
 * Activate loading FA then send mod informations through storage with mod's name to main process
 */

function install(mod_name, t) {
    t.onclick = null;
    t.innerHTML = '<i style="display: block" class="fa fa-refresh fa-spin"></i>';

    ipcRenderer.send('install', storage.getItem(mod_name.toLowerCase()));
}

/*
* After main process installed mod, it sends back a response with mod informations
* We delete mod from remote-mods-list and update remote-mods-count
* Then we add mod informations into mods-list and update the linked mods-count
* pop a modal with status of installation
 */

ipcRenderer.on('install', (event, args, response) => {
    args = JSON.parse(args);

    if (!response) {
        const row = document.getElementById(args.name.toLowerCase());

        row.children[1].innerHTML = JSON.parse(storage.getItem(args.name.toLowerCase())).version;

        document.getElementById('error').classList.remove('hidden');
        document.getElementById('error-message').innerText = 'A checksum error happened during installation';
        document.getElementById('error-message').style.color = 'red';

        row.removeChild(row.children[5]);
        add_download_button(args.name, row, true);
        return;
    }

    let mod_remote_to_delete = document.getElementById(args.name.toLowerCase());
    const table_remote = document.getElementById('remote-mods-list').getElementsByTagName('tbody')[0];

    table_remote.removeChild(mod_remote_to_delete);

    let counter_remote = document.getElementById('remote-mods-count');
    let cleaned_counter_remote = counter_remote.innerHTML.replace(/[^0-9]/g, '');

    cleaned_counter_remote -= 1;
    counter_remote.innerHTML = 'Available mods: ' + cleaned_counter_remote;

    const table = document.getElementById('mods-list').getElementsByTagName('tbody')[0];

    let counter = document.getElementById('mods-count');
    let cleaned_counter = counter.innerHTML.replace(/[^0-9]/g, '');

    cleaned_counter++;
    counter.innerHTML = 'Installed mods: ' + cleaned_counter;

    create_table(table, args, false);
});
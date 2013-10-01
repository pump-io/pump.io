##

if ! hash mongod 2>/dev/null; then
    sudo apt-key adv --keyserver keyserver.ubuntu.com --recv 7F0CEB10
    echo 'deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen' | sudo tee /etc/apt/sources.list.d/10gen.list
fi

sudo aptitude update
sudo aptitude install build-essential vim curl make mongodb-10gen graphicsmagick -y

if ! hash npm 2>/dev/null; then
    echo '# Added by install script for node.js and npm in 30s' >> ~/.bashrc
    echo 'export PATH=$HOME/local/bin:$PATH' >> ~/.bashrc
    echo 'export NODE_PATH=$HOME/local/lib/node_modules' >> ~/.bashrc
    . ~/.bashrc

    mkdir -p ~/local
    mkdir -p ~/Downloads/node-latest-install

    cd ~/Downloads/node-latest-install
    curl http://nodejs.org/dist/node-latest.tar.gz | tar xz --strip-components=1

    ./configure # if SSL support is not required, use --without-ssl
    sudo make install
    echo npm version `npm -v`
    echo node version `node -v`
fi


cd /vagrant
sudo cp vagrantfiles/pump.io.json /etc/pump.io.json 
npm install
#sudo chown -R vagrant:vagrant node_modules
cd /vagrant/node_modules
npm install databank-mongodb

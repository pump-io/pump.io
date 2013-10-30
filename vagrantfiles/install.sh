##

if ! hash mongod 2>/dev/null; then
    sudo apt-key adv --keyserver keyserver.ubuntu.com --recv 7F0CEB10
    echo 'deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen' | sudo tee /etc/apt/sources.list.d/10gen.list
fi

if ! hash npm 2>/dev/null; then
    sudo aptitude update
    sudo aptitude install build-essential vim curl make mongodb-10gen graphicsmagick python-software-properties -y
    sudo add-apt-repository ppa:chris-lea/node.js -y
    sudo aptitude update
    sudo aptitude install nodejs -y
    
    echo npm version `npm -v`
    echo node version `node -v`
fi

cd /vagrant
sudo cp vagrantfiles/pump.io.json /etc/pump.io.json 
npm install
#sudo chown -R vagrant:vagrant node_modules
cd /vagrant/node_modules
npm install databank-mongodb

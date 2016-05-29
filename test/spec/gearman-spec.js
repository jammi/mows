'use strict';

const servers = require('../config')().config.gearmanServers;
const expect = require('chai').expect;

const Gearman = require('../../lib/util/gearman');

describe('Gearman promisified utility', function() {
  it('simple json worker and client behave as expected', function(done) {
    const gearman = Gearman(servers);
    const numbersToAdd = [10, 20, 30, 40];
    let testSum = 0;
    gearman
      .worker('arraySum:json', function(numbers) {
        let sum = 0;
        numbers.forEach(number => {
          sum += number;
          this.progress({number, sum});
        });
        this.send({sum});
      })
      .then(worker => {
        expect(worker).to.be.an.object;
        gearman
          .client('arraySum:json', numbersToAdd, {
            progress: (data) => {
              const number = numbersToAdd.shift();
              testSum += number;
              expect(number).to.equal(data.number);
              expect(testSum).to.equal(data.sum);
            }
          })
          .then(data => {
            expect(testSum).to.equal(100);
            expect(data.sum).to.equal(100);
            expect(numbersToAdd).to.have.length(0);
            worker.removeFunction('arraySum:json');
            done();
          })
          .catch(done);
      })
      .catch(done);
  });

  it('simple string worker and client behave as expected', function(done) {
    const gearman = Gearman(servers);
    gearman
      .worker('reverse:str', function(str) {
        return str.split('').reverse().join('');
      })
      .then(worker => {
        gearman
          .client('reverse:str', 'hello')
          .then(data => {
            expect(data).to.equal('olleh');
            worker.removeFunction('reverse:str');
            done();
          })
          .catch(done);
      })
      .catch(done);
  });

  it('simple int worker and client behave as expected', function(done) {
    const gearman = Gearman(servers);
    gearman
      .worker('pow2:int', function(num) {
        return num * num;
      })
      .then(worker => {
        gearman
          .client('pow2:int', 8)
          .then(data => {
            expect(data).to.equal(64);
            worker.removeFunction('pow2:int');
            done();
          })
          .catch(done);
      })
      .catch(done);
  });

  it('simple float worker and client behave as expected', function(done) {
    const gearman = Gearman(servers);
    gearman
      .worker('div2:float', function(num) {
        return num / 2;
      })
      .then(worker => {
        gearman
          .client('div2:float', 5)
          .then(data => {
            expect(data).to.equal(2.5);
            worker.removeFunction('div2:float');
            done();
          })
          .catch(done);
      })
      .catch(done);
  });

  it('simple binary worker and client behave as expected', function(done) {
    const gearman = Gearman(servers);
    gearman
      .worker('add1:bin', function(bin) {
        return bin.map((c) => {
          return c + 1;
        });
      })
      .then(worker => {
        gearman
          .client('add1:bin', Buffer.from('hello'))
          .then(data => {
            expect(data.toString()).to.equal('ifmmp');
            worker.removeFunction('add1:bin');
            done();
          })
          .catch(done);
      })
      .catch(done);
  });

});
